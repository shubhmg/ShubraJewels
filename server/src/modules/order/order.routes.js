import express from 'express';
import Joi from 'joi';
import Order from './order.model.js';
import Product from '../product/product.model.js';
import validate from '../../middleware/validate.js';
import requireAdmin from '../../middleware/auth.js';
import { optionalCustomer } from '../../middleware/customerAuth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';

const router = express.Router();
const objectId = Joi.string().hex().length(24);

async function nextOrderNo() {
  const yy = new Date().getFullYear();
  const count = await Order.countDocuments();
  return `SJ-${yy}-${String(count + 1).padStart(5, '0')}`;
}

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
      notes: Joi.string().allow('').max(1000),
    }),
  }),
  asyncHandler(async (req, res) => {
    const ids = req.body.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: ids } }).lean();
    const map = new Map(products.map((p) => [String(p._id), p]));

    const items = req.body.items.map((i) => {
      const p = map.get(String(i.productId));
      if (!p) throw ApiError.badRequest('One or more products are no longer available');
      return { productId: p._id, name: p.name, image: p.images?.[0] || '', price: p.price, qty: i.qty };
    });

    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const order = await Order.create({
      orderNo: await nextOrderNo(),
      customerId: req.customer?.id || null,
      items,
      customer: req.body.customer,
      address: req.body.address || {},
      subtotal,
      shipping: 0,
      total: subtotal,
      channel: req.body.channel || 'web',
      notes: req.body.notes || '',
    });

    res.status(201).json({ success: true, data: order });
  })
);

// ADMIN — list
router.get(
  '/',
  requireAdmin,
  validate({ query: Joi.object({ status: Joi.string().allow('') }) }),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: orders });
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
      notes: Joi.string().allow('').max(1000),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');

    if (req.body.status !== undefined) order.status = req.body.status;
    if (req.body.notes !== undefined) order.notes = req.body.notes;

    const delivered = order.status === 'delivered';
    if (delivered && !order.stockApplied) {
      await applyOrderStock(order, -1);
      order.stockApplied = true;
    } else if (!delivered && order.stockApplied) {
      await applyOrderStock(order, +1);
      order.stockApplied = false;
    }

    await order.save();
    res.json({ success: true, data: order });
  })
);

export default router;
