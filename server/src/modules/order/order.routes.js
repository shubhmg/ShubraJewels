import express from 'express';
import Joi from 'joi';
import Order from './order.model.js';
import Product from '../product/product.model.js';
import Coupon from '../coupon/coupon.model.js';
import { getSettings } from '../setting/setting.model.js';
import { resolveCoupon } from '../coupon/coupon.service.js';
import { computeShipping } from '../../utils/pricing.js';
import { resolveItems } from '../../utils/resolveItems.js';
import { nextOrderNo } from '../../utils/sequence.js';
import validate from '../../middleware/validate.js';
import requireAdmin from '../../middleware/auth.js';
import { optionalCustomer } from '../../middleware/customerAuth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';

const router = express.Router();
const objectId = Joi.string().hex().length(24);

// PUBLIC — place an order. Prices are re-read from the DB (never trust client totals).
// If a signed-in customer places it, the order is linked to their account.
router.post(
  '/',
  optionalCustomer,
  validate({
    body: Joi.object({
      items: Joi.array()
        .items(Joi.object({ productId: objectId.required(), qty: Joi.number().min(1).required() }))
        .min(1)
        .required(),
      customer: Joi.object({
        name: Joi.string().max(120).required(),
        phone: Joi.string().max(20).required(),
        email: Joi.string().email().allow('').default(''),
      }).required(),
      address: Joi.object({
        line1: Joi.string().allow('').max(200),
        line2: Joi.string().allow('').max(200),
        city: Joi.string().allow('').max(80),
        state: Joi.string().allow('').max(80),
        pincode: Joi.string().allow('').max(12),
      }).default({}),
      channel: Joi.string().valid('web', 'whatsapp').default('web'),
      paymentMethod: Joi.string().valid('cod', 'whatsapp', 'none').optional(),
      couponCode: Joi.string().allow('').max(40).default(''),
      notes: Joi.string().allow('').max(1000),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { items, subtotal } = await resolveItems(req.body.items);
    const settings = await getSettings();
    const shipping = computeShipping(settings, req.body.address?.city, subtotal);

    // Re-validate the coupon server-side (never trust a client-sent discount).
    let discount = 0;
    let couponCode = '';
    let appliedCoupon = null;
    if (req.body.couponCode) {
      const r = await resolveCoupon(req.body.couponCode, subtotal);
      if (r.error) throw ApiError.badRequest(r.error);
      discount = r.discount;
      couponCode = r.coupon.code;
      appliedCoupon = r.coupon;
    }

    const total = Math.max(0, subtotal + shipping - discount);
    const order = await Order.create({
      orderNo: await nextOrderNo(),
      customerId: req.customer?.id || null,
      items,
      customer: req.body.customer,
      address: req.body.address || {},
      subtotal,
      shipping,
      discount,
      couponCode,
      total,
      channel: req.body.channel || 'web',
      paymentMethod: req.body.paymentMethod || (req.body.channel === 'whatsapp' ? 'whatsapp' : 'cod'),
      paymentStatus: 'unpaid', // COD / WhatsApp orders are collected later
      notes: req.body.notes || '',
    });

    if (appliedCoupon) await Coupon.updateOne({ _id: appliedCoupon._id }, { $inc: { usedCount: 1 } });

    res.status(201).json({ success: true, data: order });
  })
);

// ADMIN — paginated list with status filter, search, and per-status counts.
const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get(
  '/',
  requireAdmin,
  validate({
    query: Joi.object({
      status: Joi.string().allow('').default(''),
      search: Joi.string().allow('').max(120).default(''),
      page: Joi.number().min(1).default(1),
      limit: Joi.number().min(1).max(100).default(20),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { status, search, page, limit } = req.query;
    const base = {}; // search-only filter (status excluded so tab counts stay accurate)
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      base.$or = [{ orderNo: rx }, { 'customer.name': rx }, { 'customer.phone': rx }];
    }
    const listFilter = status ? { ...base, status } : base;

    const [items, statusAgg] = await Promise.all([
      Order.find(listFilter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Order.aggregate([{ $match: base }, { $group: { _id: '$status', c: { $sum: 1 } } }]),
    ]);

    const counts = { all: 0 };
    ORDER_STATUSES.forEach((s) => { counts[s] = 0; });
    for (const g of statusAgg) { counts[g._id] = g.c; counts.all += g.c; }
    const total = status ? (counts[status] || 0) : counts.all;

    res.json({ success: true, data: { items, total, page, limit, counts } });
  })
);

// Adjust product stock by a signed multiplier (+1 restock, -1 deduct); clamps at 0.
async function applyOrderStock(order, sign) {
  for (const it of order.items) {
    if (!it.productId) continue;
    const p = await Product.findById(it.productId);
    if (!p) continue;
    p.stockQty = Math.max(0, (p.stockQty || 0) + sign * it.qty);
    p.inStock = p.stockQty > 0;
    await p.save();
  }
}

// ADMIN — update status / notes. Stock is deducted when an order becomes
// 'delivered', and added back if it later leaves 'delivered' (or is cancelled).
router.patch(
  '/:id',
  requireAdmin,
  validate({
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'),
      paymentStatus: Joi.string().valid('unpaid', 'paid'),
      paymentMethod: Joi.string().valid('none', 'razorpay', 'cod', 'whatsapp', 'cash', 'upi', 'bank'),
      notes: Joi.string().allow('').max(1000),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');

    if (req.body.status !== undefined) order.status = req.body.status;
    if (req.body.notes !== undefined) order.notes = req.body.notes;
    if (req.body.paymentMethod !== undefined) order.paymentMethod = req.body.paymentMethod;

    const delivered = order.status === 'delivered';
    if (delivered && !order.stockApplied) {
      await applyOrderStock(order, -1);
      order.stockApplied = true;
    } else if (!delivered && order.stockApplied) {
      await applyOrderStock(order, +1);
      order.stockApplied = false;
    }

    // Cash is collected on delivery — COD/WhatsApp orders become paid when delivered
    // (and revert to unpaid if moved back). Razorpay orders are already paid.
    if (delivered) {
      if (order.paymentStatus === 'unpaid') order.paymentStatus = 'paid';
    } else if (order.paymentMethod !== 'razorpay') {
      order.paymentStatus = 'unpaid';
    }

    // Explicit payment status from admin wins (e.g. "mark paid" before delivery).
    if (req.body.paymentStatus !== undefined) order.paymentStatus = req.body.paymentStatus;

    await order.save();
    res.json({ success: true, data: order });
  })
);

// ADMIN — manually log an order (e.g. from WhatsApp) for bookkeeping + inventory.
router.post(
  '/manual',
  requireAdmin,
  validate({
    body: Joi.object({
      items: Joi.array().items(Joi.object({ productId: objectId.required(), qty: Joi.number().min(1).required() })).min(1).required(),
      customer: Joi.object({
        name: Joi.string().max(120).required(),
        phone: Joi.string().max(20).required(),
        email: Joi.string().email().allow('').default(''),
      }).required(),
      address: Joi.object({
        line1: Joi.string().allow('').max(200), line2: Joi.string().allow('').max(200),
        city: Joi.string().allow('').max(80), state: Joi.string().allow('').max(80), pincode: Joi.string().allow('').max(12),
      }).default({}),
      status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled').default('pending'),
      paymentMethod: Joi.string().valid('cod', 'whatsapp', 'cash', 'upi', 'bank').default('whatsapp'),
      paymentStatus: Joi.string().valid('unpaid', 'paid').default('unpaid'),
      notes: Joi.string().allow('').max(1000),
    }),
  }),
  asyncHandler(async (req, res) => {
    // Admin bookkeeping may log past/sold-out items — don't block on availability.
    const { items, subtotal } = await resolveItems(req.body.items, { requireAvailable: false });

    const order = new Order({
      orderNo: await nextOrderNo(),
      items,
      customer: req.body.customer,
      address: req.body.address || {},
      subtotal, shipping: 0, total: subtotal,
      channel: 'whatsapp',
      status: req.body.status,
      paymentMethod: req.body.paymentMethod,
      paymentStatus: req.body.paymentStatus,
      notes: req.body.notes || '',
    });
    // Deduct stock if logged as already delivered; delivered also implies paid.
    if (order.status === 'delivered') {
      await applyOrderStock(order, -1);
      order.stockApplied = true;
      if (order.paymentStatus === 'unpaid') order.paymentStatus = 'paid';
    }
    await order.save();
    res.status(201).json({ success: true, data: order });
  })
);

// ADMIN — wipe ALL orders (pre-launch testing cleanup). Guarded by a confirm
// token so it can't be triggered accidentally. Does not touch stock.
router.post(
  '/delete-all',
  requireAdmin,
  validate({ body: Joi.object({ confirm: Joi.string().valid('DELETE_ALL').required() }) }),
  asyncHandler(async (req, res) => {
    const { deletedCount } = await Order.deleteMany({});
    res.json({ success: true, data: { deletedCount } });
  })
);

export default router;
