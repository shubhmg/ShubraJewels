import express from 'express';
import Joi from 'joi';
import Order from './order.model.js';
import Coupon from '../coupon/coupon.model.js';
import { getSettings } from '../setting/setting.model.js';
import { resolveCoupon } from '../coupon/coupon.service.js';
import { computeCharges } from '../../utils/pricing.js';
import { resolveItems } from '../../utils/resolveItems.js';
import { nextOrderNo } from '../../utils/sequence.js';
import { sendTelegram, orderMessage, orderPhotos } from '../../utils/notify.js';
import { sendOrderConfirmation, sendOrderShipped } from '../../utils/mailer.js';
import { reconcileOrderStock, checkAvailability, reserveProducts, releaseProducts } from './orderStock.js';
import {
  delhiveryConfig, delhiveryReady, checkServiceability,
  createShipment, cancelShipment, trackShipment, labelLink, trackingUrl,
} from '../../utils/delhivery.js';
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
        email: Joi.string().email().required(),
      }).required(),
      address: Joi.object({
        line1: Joi.string().allow('').max(200),
        line2: Joi.string().allow('').max(200),
        landmark: Joi.string().allow('').max(120),
        city: Joi.string().allow('').max(80),
        state: Joi.string().allow('').max(80),
        pincode: Joi.string().allow('').max(12),
      }).default({}),
      channel: Joi.string().valid('web').default('web'),
      paymentMethod: Joi.string().valid('cod').default('cod'),
      couponCode: Joi.string().allow('').max(40).default(''),
      notes: Joi.string().allow('').max(1000),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { items, subtotal } = await resolveItems(req.body.items);
    const settings = await getSettings();
    const paymentMethod = 'cod';
    const { shipping, codFee } = computeCharges(settings, req.body.address || {}, paymentMethod, subtotal);

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

    const total = Math.max(0, subtotal + shipping + codFee - discount);

    // Atomically reserve stock FIRST. If a concurrent order took the last unit
    // this throws a 409 (with the shortfall) before we consume an order number
    // or persist anything — no phantom order, no oversell.
    await reserveProducts(items);

    const order = new Order({
      orderNo: await nextOrderNo(),
      customerId: req.customer?.id || null,
      items,
      customer: req.body.customer,
      address: req.body.address || {},
      subtotal,
      shipping,
      codFee,
      discount,
      couponCode,
      total,
      channel: 'web',
      paymentMethod,
      paymentStatus: 'unpaid', // COD collected on delivery
      notes: req.body.notes || '',
      stockApplied: true, // reserved just above
    });

    try {
      await order.save();
    } catch (e) {
      await releaseProducts(items); // couldn't persist — give the stock back
      throw e;
    }

    if (appliedCoupon) await Coupon.updateOne({ _id: appliedCoupon._id }, { $inc: { usedCount: 1 } });

    // Ping the owner on Telegram (best-effort — never blocks the response).
    sendTelegram(settings, orderMessage(order), { photos: orderPhotos(order) }).catch(() => {});

    // Send order confirmation email to the customer (best-effort).
    sendOrderConfirmation(order.toObject(), settings)
      .then((r) => { if (!r.ok) console.error('[mailer] order email failed:', r.error); })
      .catch((e) => console.error('[mailer] unexpected error:', e.message));

    res.status(201).json({ success: true, data: order });
  })
);

// PUBLIC — pre-flight availability probe. The checkout calls this the moment
// before opening the payment methods, so a customer whose item sold out while
// they filled the form is told immediately (never mid-payment). Read-only.
router.post(
  '/check-stock',
  validate({
    body: Joi.object({
      items: Joi.array().items(Joi.object({ productId: objectId.required(), qty: Joi.number().min(1).required() })).min(1).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await checkAvailability(req.body.items);
    res.json({ success: true, data: result });
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

// ADMIN — update status / notes / tracking. Stock is reserved when an order is
// confirmed and released if it's cancelled (see reconcileOrderStock).
router.patch(
  '/:id',
  requireAdmin,
  validate({
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'),
      paymentStatus: Joi.string().valid('unpaid', 'submitted', 'paid'),
      paymentMethod: Joi.string().valid('none', 'razorpay', 'cod', 'whatsapp', 'cash', 'upi', 'bank'),
      notes: Joi.string().allow('').max(1000),
      tracking: Joi.object({
        message: Joi.string().allow('').max(1000),
      }),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');

    const wasShipped = order.status === 'shipped';
    if (req.body.status !== undefined) order.status = req.body.status;
    if (req.body.notes !== undefined) order.notes = req.body.notes;
    if (req.body.paymentMethod !== undefined) order.paymentMethod = req.body.paymentMethod;
    order.expiresAt = null; // admin touched it — keep it, never auto-expire

    // Shipment tracking message (delivery-partner note), typically set with Shipped.
    if (req.body.tracking && typeof req.body.tracking === 'object' && req.body.tracking.message !== undefined) {
      order.tracking.message = req.body.tracking.message;
    }
    if (order.status === 'shipped' && !order.tracking.shippedAt) order.tracking.shippedAt = new Date();

    // Reserve / release inventory to match the new state.
    await reconcileOrderStock(order);

    // Cash is collected on delivery — COD/WhatsApp orders become paid when delivered
    // (and revert to unpaid if moved back). Razorpay + UPI keep their own status.
    const collectOnDelivery = ['cod', 'whatsapp', 'cash', 'none'].includes(order.paymentMethod);
    if (order.status === 'delivered') {
      if (order.paymentStatus === 'unpaid') order.paymentStatus = 'paid';
    } else if (collectOnDelivery) {
      order.paymentStatus = 'unpaid';
    }

    // Explicit payment status from admin wins (e.g. verifying a UPI payment).
    if (req.body.paymentStatus !== undefined) order.paymentStatus = req.body.paymentStatus;
    if (order.paymentStatus === 'paid' && !order.paymentVerifiedAt) order.paymentVerifiedAt = new Date();

    await order.save();

    // Email the customer their shipment update the moment the order becomes
    // shipped (best-effort — never blocks the response).
    if (!wasShipped && order.status === 'shipped') {
      getSettings()
        .then((s) => sendOrderShipped(order.toObject(), s))
        .then((r) => { if (!r.ok) console.error('[mailer] shipped email failed:', r.error); })
        .catch((e) => console.error('[mailer] unexpected error:', e.message));
    }

    res.json({ success: true, data: order });
  })
);

// Customer-facing tracking note auto-filled when a Delhivery waybill is booked.
function delhiveryTrackingMessage(waybill) {
  return `Shipped via Delhivery. Tracking ID: ${waybill}\nTrack your parcel: ${trackingUrl(waybill)}`;
}

// ADMIN — book a Delhivery shipment for an order, then mark it Shipped.
// Creates the waybill, stores the shipment on the order, auto-fills the customer
// tracking message, and emails the shipped notification (best-effort).
router.post(
  '/:id/ship-delhivery',
  requireAdmin,
  validate({
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({ weight: Joi.number().min(1).max(50000).optional() }).default({}),
  }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status === 'cancelled') throw ApiError.badRequest('Order is cancelled');
    if (order.shipment?.provider === 'delhivery' && order.shipment?.waybill) {
      throw ApiError.badRequest(`Already booked with Delhivery (AWB ${order.shipment.waybill}).`);
    }

    const settings = await getSettings();
    if (!delhiveryReady(delhiveryConfig(settings))) {
      throw ApiError.badRequest('Delhivery is not fully configured. Add the API token and pickup warehouse in Settings.');
    }

    const result = await createShipment(settings, order.toObject(), { weight: req.body.weight });
    if (!result.ok) throw ApiError.badRequest(result.error || 'Delhivery could not book this shipment.');

    const wasShipped = order.status === 'shipped';
    order.shipment = {
      provider: 'delhivery',
      waybill: result.waybill,
      mode: result.mode,
      codAmount: result.codAmount || 0,
      weightGrams: result.weight || 0,
      status: 'Booked',
      statusDetail: '',
      labelUrl: '',
      bookedAt: new Date(),
      lastSyncedAt: new Date(),
    };
    order.tracking.message = delhiveryTrackingMessage(result.waybill);
    order.status = 'shipped';
    if (!order.tracking.shippedAt) order.tracking.shippedAt = new Date();
    order.expiresAt = null;
    await reconcileOrderStock(order);
    await order.save();

    // Fetch the label link in the background (it may not be ready instantly).
    labelLink(settings, result.waybill)
      .then((l) => { if (l.ok) Order.updateOne({ _id: order._id }, { 'shipment.labelUrl': l.url }).catch(() => {}); })
      .catch(() => {});

    // Email the customer their shipment update (best-effort).
    if (!wasShipped) {
      sendOrderShipped(order.toObject(), settings)
        .then((r) => { if (!r.ok) console.error('[mailer] shipped email failed:', r.error); })
        .catch((e) => console.error('[mailer] unexpected error:', e.message));
    }

    res.json({ success: true, data: order });
  })
);

// ADMIN — refresh a Delhivery shipment's live status.
router.post(
  '/:id/sync-shipment',
  requireAdmin,
  validate({ params: Joi.object({ id: objectId.required() }) }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    if (order.shipment?.provider !== 'delhivery' || !order.shipment?.waybill) {
      throw ApiError.badRequest('No Delhivery shipment on this order.');
    }
    const settings = await getSettings();
    const [t, l] = await Promise.all([
      trackShipment(settings, order.shipment.waybill),
      order.shipment.labelUrl ? Promise.resolve({ ok: false }) : labelLink(settings, order.shipment.waybill),
    ]);
    if (t.ok) {
      order.shipment.status = t.status || order.shipment.status;
      order.shipment.statusDetail = [t.statusType, t.location].filter(Boolean).join(' · ');
      // Auto-advance to Delivered when the courier confirms delivery.
      if (t.delivered && order.status === 'shipped') {
        order.status = 'delivered';
        if (order.paymentStatus === 'unpaid') order.paymentStatus = 'paid';
        await reconcileOrderStock(order);
      }
    }
    if (l.ok) order.shipment.labelUrl = l.url;
    order.shipment.lastSyncedAt = new Date();
    await order.save();
    res.json({ success: true, data: order, meta: { synced: t.ok, error: t.ok ? null : t.error } });
  })
);

// ADMIN — cancel a Delhivery shipment (does not change the order's own status).
router.post(
  '/:id/cancel-shipment',
  requireAdmin,
  validate({ params: Joi.object({ id: objectId.required() }) }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    if (order.shipment?.provider !== 'delhivery' || !order.shipment?.waybill) {
      throw ApiError.badRequest('No Delhivery shipment on this order.');
    }
    const settings = await getSettings();
    const r = await cancelShipment(settings, order.shipment.waybill);
    if (!r.ok) throw ApiError.badRequest(r.error || 'Delhivery could not cancel this waybill.');
    order.shipment.status = 'Cancelled';
    order.shipment.lastSyncedAt = new Date();
    await order.save();
    res.json({ success: true, data: order });
  })
);

// ADMIN — get the packing-slip / shipping-label PDF link for a waybill.
router.get(
  '/:id/label',
  requireAdmin,
  validate({ params: Joi.object({ id: objectId.required() }) }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    if (order.shipment?.provider !== 'delhivery' || !order.shipment?.waybill) {
      throw ApiError.badRequest('No Delhivery shipment on this order.');
    }
    const settings = await getSettings();
    const r = await labelLink(settings, order.shipment.waybill);
    if (!r.ok) throw ApiError.badRequest(r.error || 'Label not ready yet. Try again in a moment.');
    if (order.shipment.labelUrl !== r.url) {
      order.shipment.labelUrl = r.url;
      await order.save();
    }
    res.json({ success: true, data: { url: r.url } });
  })
);

// ADMIN — Delhivery PIN serviceability probe (for the ship form).
router.get(
  '/delhivery/serviceability',
  requireAdmin,
  validate({ query: Joi.object({ pin: Joi.string().pattern(/^\d{6}$/).required() }) }),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const r = await checkServiceability(settings, req.query.pin);
    if (!r.ok) throw ApiError.badRequest(r.error || 'Could not check serviceability');
    res.json({ success: true, data: r });
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
        line1: Joi.string().allow('').max(200), line2: Joi.string().allow('').max(200), landmark: Joi.string().allow('').max(120),
        city: Joi.string().allow('').max(80), state: Joi.string().allow('').max(80), pincode: Joi.string().allow('').max(12),
      }).default({}),
      status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled').default('confirmed'),
      paymentMethod: Joi.string().valid('cod', 'cash', 'upi', 'bank').default('cod'),
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
      channel: 'web',
      status: req.body.status,
      paymentMethod: req.body.paymentMethod,
      paymentStatus: req.body.paymentStatus,
      notes: req.body.notes || '',
    });
    if (order.status === 'delivered' && order.paymentStatus === 'unpaid') order.paymentStatus = 'paid';
    // Reserve stock to match the logged state (confirmed/shipped/delivered).
    await reconcileOrderStock(order);
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
