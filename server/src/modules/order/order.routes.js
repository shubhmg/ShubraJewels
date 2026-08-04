import express from 'express';
import crypto from 'node:crypto';
import Joi from 'joi';
import Order from './order.model.js';
import Coupon from '../coupon/coupon.model.js';
import { getSettings } from '../setting/setting.model.js';
import { resolveCoupon } from '../coupon/coupon.service.js';
import { computeCharges } from '../../utils/pricing.js';
import { resolveItems } from '../../utils/resolveItems.js';
import { nextOrderNo } from '../../utils/sequence.js';
import { sendTelegram, orderMessage, orderPhotos } from '../../utils/notify.js';
import { sendOrderConfirmation, sendOrderShipped, sendOrderCancelled } from '../../utils/mailer.js';
import { reconcileOrderStock, checkAvailability, reserveProducts, releaseProducts } from './orderStock.js';
import * as shiprocket from '../../utils/shiprocket.js';
import * as delhivery from '../../utils/delhivery.js';
import * as xpressbees from '../../utils/xpressbees.js';
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
      // Payment sub-filter: 'paid' = money already received (prepaid/online),
      // 'cod' = to be collected on delivery (not yet paid).
      payment: Joi.string().valid('', 'paid', 'cod').default(''),
      page: Joi.number().min(1).default(1),
      limit: Joi.number().min(1).max(100).default(20),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { status, search, payment, page, limit } = req.query;
    const base = {}; // search-only filter (status excluded so tab counts stay accurate)
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      base.$or = [{ orderNo: rx }, { 'customer.name': rx }, { 'customer.phone': rx }];
    }
    const statusFilter = status ? { ...base, status } : base;
    const payMatch = payment === 'paid' ? { paymentStatus: 'paid' }
      : payment === 'cod' ? { paymentStatus: { $ne: 'paid' } }
      : null;
    const listFilter = payMatch ? { ...statusFilter, ...payMatch } : statusFilter;

    const [items, statusAgg, payAgg, total] = await Promise.all([
      Order.find(listFilter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Order.aggregate([{ $match: base }, { $group: { _id: '$status', c: { $sum: 1 } } }]),
      // Paid-vs-COD split within the active status (drives the sub-filter chips).
      Order.aggregate([
        { $match: statusFilter },
        { $group: { _id: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 'paid', 'cod'] }, c: { $sum: 1 } } },
      ]),
      payMatch ? Order.countDocuments(listFilter) : Promise.resolve(null),
    ]);

    const counts = { all: 0 };
    ORDER_STATUSES.forEach((s) => { counts[s] = 0; });
    for (const g of statusAgg) { counts[g._id] = g.c; counts.all += g.c; }

    const paymentCounts = { all: 0, paid: 0, cod: 0 };
    for (const g of payAgg) { paymentCounts[g._id] = g.c; paymentCounts.all += g.c; }

    const totalCount = total != null ? total : (status ? (counts[status] || 0) : counts.all);

    res.json({ success: true, data: { items, total: totalCount, page, limit, counts, paymentCounts } });
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
      paymentStatus: Joi.string().valid('unpaid', 'paid'),
      paymentMethod: Joi.string().valid('razorpay', 'cod', 'cash', 'upi', 'bank'),
      notes: Joi.string().allow('').max(1000),
      cancelReason: Joi.string().allow('').max(300),
      tracking: Joi.object({
        message: Joi.string().allow('').max(1000),
      }),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');

    const wasShipped = order.status === 'shipped';
    const wasCancelled = order.status === 'cancelled';
    if (req.body.status !== undefined) order.status = req.body.status;
    if (req.body.cancelReason !== undefined) order.cancelReason = req.body.cancelReason;
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

    // Cash is collected on delivery — COD/cash orders become paid when delivered
    // (and revert to unpaid if moved back). Razorpay + UPI keep their own status.
    const collectOnDelivery = ['cod', 'cash'].includes(order.paymentMethod);
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

    // Email the customer when the order is cancelled — includes the admin's
    // reason and a refund note if anything was paid (best-effort).
    if (!wasCancelled && order.status === 'cancelled') {
      getSettings()
        .then((s) => sendOrderCancelled(order.toObject(), s))
        .then((r) => { if (!r.ok) console.error('[mailer] cancelled email failed:', r.error); })
        .catch((e) => console.error('[mailer] unexpected error:', e.message));
    }

    res.json({ success: true, data: order });
  })
);

// Customer-facing tracking note auto-filled when a courier waybill is booked.
function shipmentTrackingMessage(provider, waybill, url) {
  const label = provider === 'delhivery' ? 'Delhivery' : provider === 'xpressbees' ? 'Xpressbees' : 'Shiprocket';
  return `Shipped via ${label}. Tracking ID: ${waybill}\nTrack your parcel: ${url}`;
}

// Book with a courier, retrying with a fresh order reference when the courier
// rejects a re-used one. Couriers key on the order id and refuse it even after a
// cancel, so re-books send `{orderNo}-R{n}`. Returns { result, attempt }.
async function bookWithRetry(order, bookFn) {
  const base = order.orderNo;
  const mkRef = (n) => (n <= 1 ? base : `${base}-R${n}`);
  const dup = (e) => /already (assigned|exist|manifest|booked)|duplicate|unique|order.*(exist|already)/i.test(e || '');
  let attempt = (order.shipmentAttempts || 0) + 1;
  let result = await bookFn(mkRef(attempt));
  let guard = 0;
  while (!result.ok && dup(result.error) && guard < 6) {
    attempt += 1; guard += 1;
    result = await bookFn(mkRef(attempt));
  }
  return { result, attempt };
}

// Atomically claim the right to book a courier for this order. Two concurrent
// ship requests (double-submit, or bulk overlapping a single ship) both pass a
// plain `if (order.shipment?.waybill)` read — this findOneAndUpdate makes only
// ONE of them win. Returns true if the claim was taken. ALWAYS release on
// failure (applyBooking's full-shipment replace clears the lock on success).
async function claimBookingSlot(orderId) {
  const r = await Order.updateOne(
    {
      _id: orderId,
      status: { $ne: 'cancelled' },
      $or: [{ 'shipment.waybill': '' }, { 'shipment.waybill': null }],
      'shipment.bookingLock': { $ne: true },
    },
    { $set: { 'shipment.bookingLock': true } }
  );
  return r.modifiedCount === 1;
}
async function releaseBookingSlot(orderId) {
  await Order.updateOne({ _id: orderId }, { $set: { 'shipment.bookingLock': false } }).catch(() => {});
}

// After a courier booking succeeds, stamp the shipment onto the order, mark it
// Shipped, auto-fill the customer tracking message + email them (best-effort).
async function applyBooking(order, settings, shipment, wasShipped) {
  order.shipment = { bookedAt: new Date(), lastSyncedAt: new Date(), status: 'Booked', ...shipment };
  order.tracking.message = shipmentTrackingMessage(shipment.provider, shipment.waybill, shipment.trackingUrl);
  order.status = 'shipped';
  if (!order.tracking.shippedAt) order.tracking.shippedAt = new Date();
  order.expiresAt = null;
  await reconcileOrderStock(order);
  await order.save();

  if (!wasShipped) {
    sendOrderShipped(order.toObject(), settings)
      .then((r) => { if (!r.ok) console.error('[mailer] shipped email failed:', r.error); })
      .catch((e) => console.error('[mailer] unexpected error:', e.message));
  }
}

// ADMIN — book a Shiprocket shipment (create order → assign AWB), then mark Shipped.
router.post(
  '/:id/ship-shiprocket',
  requireAdmin,
  validate({
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      weight: Joi.number().min(0.01).max(50).optional(), // kg
      courierId: Joi.number().integer().positive().optional(), // force a specific courier (from serviceability list)
    }).default({}),
  }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status === 'cancelled') throw ApiError.badRequest('Order is cancelled');
    if (order.shipment?.waybill) throw ApiError.badRequest(`Already booked (AWB ${order.shipment.waybill}). Cancel it first to rebook.`);

    const settings = await getSettings();
    if (!shiprocket.shiprocketReady(shiprocket.shiprocketConfig(settings))) {
      throw ApiError.badRequest('Shiprocket is not fully configured. Add the email, API password and pickup location in Settings.');
    }
    if (!(await claimBookingSlot(order._id))) throw ApiError.badRequest('A booking for this order is already in progress or done. Refresh and check.');
    let result, attempt;
    try {
      ({ result, attempt } = await bookWithRetry(order, (ref) =>
        shiprocket.createShipment(settings, order.toObject(), { weightKg: req.body.weight, courierId: req.body.courierId, orderRef: ref })));
      if (!result.ok) throw ApiError.badRequest(result.error || 'Shiprocket could not book this shipment.');
    } catch (e) {
      await releaseBookingSlot(order._id);
      throw e;
    }

    const wasShipped = order.status === 'shipped';
    order.shipmentAttempts = attempt;
    await applyBooking(order, settings, {
      provider: 'shiprocket',
      waybill: result.awb,
      shipmentId: result.shipmentId,
      srOrderId: result.srOrderId,
      courierName: result.courierName,
      trackingUrl: result.trackingUrl,
      mode: result.mode,
      codAmount: result.codAmount || 0,
      weightGrams: Math.round((result.weightKg || 0) * 1000),
      labelUrl: result.labelUrl || '',
    }, wasShipped);

    res.json({ success: true, data: order });
  })
);

// ADMIN — book a Delhivery shipment (CMU create), then mark Shipped.
router.post(
  '/:id/ship-delhivery',
  requireAdmin,
  validate({
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      weight: Joi.number().integer().min(1).max(50000).optional(), // grams
    }).default({}),
  }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status === 'cancelled') throw ApiError.badRequest('Order is cancelled');
    if (order.shipment?.waybill) throw ApiError.badRequest(`Already booked (AWB ${order.shipment.waybill}). Cancel it first to rebook.`);

    const settings = await getSettings();
    if (!delhivery.delhiveryReady(delhivery.delhiveryConfig(settings))) {
      throw ApiError.badRequest('Delhivery is not fully configured. Add the API token and pickup warehouse in Settings.');
    }
    if (!(await claimBookingSlot(order._id))) throw ApiError.badRequest('A booking for this order is already in progress or done. Refresh and check.');
    let result, attempt;
    try {
      ({ result, attempt } = await bookWithRetry(order, (ref) =>
        delhivery.createShipment(settings, order.toObject(), { weight: req.body.weight, orderRef: ref })));
      if (!result.ok) throw ApiError.badRequest(result.error || 'Delhivery could not book this shipment.');
    } catch (e) {
      await releaseBookingSlot(order._id);
      throw e;
    }

    const wasShipped = order.status === 'shipped';
    order.shipmentAttempts = attempt;
    await applyBooking(order, settings, {
      provider: 'delhivery',
      waybill: result.waybill,
      trackingUrl: delhivery.trackingUrl(result.waybill),
      mode: result.mode,
      codAmount: result.codAmount || 0,
      weightGrams: result.weight || 0,
    }, wasShipped);

    res.json({ success: true, data: order });
  })
);

// ADMIN — book an Xpressbees shipment (single call: order + AWB + label), then mark Shipped.
router.post(
  '/:id/ship-xpressbees',
  requireAdmin,
  validate({
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      weight: Joi.number().integer().min(1).max(50000).optional(), // grams
      courierId: Joi.alternatives().try(Joi.string(), Joi.number()).optional(), // force a service (from serviceability list)
    }).default({}),
  }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status === 'cancelled') throw ApiError.badRequest('Order is cancelled');
    if (order.shipment?.waybill) throw ApiError.badRequest(`Already booked (AWB ${order.shipment.waybill}). Cancel it first to rebook.`);

    const settings = await getSettings();
    if (!xpressbees.xpressbeesReady(xpressbees.xpressbeesConfig(settings))) {
      throw ApiError.badRequest('Xpressbees is not fully configured. Add the email, password and full pickup address in Settings.');
    }
    if (!(await claimBookingSlot(order._id))) throw ApiError.badRequest('A booking for this order is already in progress or done. Refresh and check.');
    let result, attempt;
    try {
      ({ result, attempt } = await bookWithRetry(order, (ref) =>
        xpressbees.createShipment(settings, order.toObject(), { weight: req.body.weight, courierId: req.body.courierId, orderRef: ref })));
      if (!result.ok) throw ApiError.badRequest(result.error || 'Xpressbees could not book this shipment.');
    } catch (e) {
      await releaseBookingSlot(order._id);
      throw e;
    }

    const wasShipped = order.status === 'shipped';
    order.shipmentAttempts = attempt;
    await applyBooking(order, settings, {
      provider: 'xpressbees',
      waybill: result.awb,
      shipmentId: result.shipmentId,
      courierName: result.courierName,
      trackingUrl: result.trackingUrl,
      mode: result.mode,
      codAmount: result.codAmount || 0,
      weightGrams: result.weightGrams || 0,
      labelUrl: result.labelUrl || '',
    }, wasShipped);

    res.json({ success: true, data: order });
  })
);

// ADMIN — bulk-book a courier for many orders at once (provider = shiprocket |
// delhivery | xpressbees, default shiprocket). Uses each order's default weight, books
// sequentially (avoids assignment races/rate limits); Shiprocket then clubs ONE
// pickup request for the batch when auto-pickup is on (Delhivery has no clubbed
// pickup — arrange it from the panel). Partial success is normal: failures are
// returned per order and those orders stay untouched in To Ship.
router.post(
  '/bulk-ship',
  requireAdmin,
  validate({ body: Joi.object({
    ids: Joi.array().items(objectId).min(1).max(50).required(),
    provider: Joi.string().valid('shiprocket', 'delhivery', 'xpressbees').default('shiprocket'),
  }) }),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const provider = req.body.provider;
    const isDel = provider === 'delhivery';
    const isXb = provider === 'xpressbees';
    if (isDel) {
      if (!delhivery.delhiveryReady(delhivery.delhiveryConfig(settings))) {
        throw ApiError.badRequest('Delhivery is not fully configured. Add the API token and pickup warehouse in Settings.');
      }
    } else if (isXb) {
      if (!xpressbees.xpressbeesReady(xpressbees.xpressbeesConfig(settings))) {
        throw ApiError.badRequest('Xpressbees is not fully configured. Add the email, password and pickup details in Settings.');
      }
    } else if (!shiprocket.shiprocketReady(shiprocket.shiprocketConfig(settings))) {
      throw ApiError.badRequest('Shiprocket is not fully configured. Add the email, API password and pickup location in Settings.');
    }

    const booked = [];
    const failed = [];
    const shipmentIds = [];

    for (const id of req.body.ids) {
      const order = await Order.findById(id);
      if (!order) { failed.push({ orderNo: String(id), error: 'Order not found' }); continue; }
      if (order.status === 'cancelled') { failed.push({ orderNo: order.orderNo, error: 'Order is cancelled' }); continue; }
      if (order.shipment?.waybill) { failed.push({ orderNo: order.orderNo, error: `Already booked (AWB ${order.shipment.waybill})` }); continue; }
      if (!(await claimBookingSlot(order._id))) { failed.push({ orderNo: order.orderNo, error: 'Booking already in progress elsewhere' }); continue; }

      const { result, attempt } = await bookWithRetry(order, (ref) =>
        isDel
          ? delhivery.createShipment(settings, order.toObject(), { orderRef: ref })
          : isXb
            ? xpressbees.createShipment(settings, order.toObject(), { orderRef: ref })
            : shiprocket.createShipment(settings, order.toObject(), { orderRef: ref, skipPickup: true }));
      if (!result.ok) { await releaseBookingSlot(order._id); failed.push({ orderNo: order.orderNo, error: result.error || 'Booking failed' }); continue; }

      const wasShipped = order.status === 'shipped';
      order.shipmentAttempts = attempt;
      const shipment = isDel
        ? {
            provider: 'delhivery',
            waybill: result.waybill,
            trackingUrl: delhivery.trackingUrl(result.waybill),
            mode: result.mode,
            codAmount: result.codAmount || 0,
            weightGrams: result.weight || 0,
          }
        : isXb
          ? {
              provider: 'xpressbees',
              waybill: result.awb,
              shipmentId: result.shipmentId,
              courierName: result.courierName,
              trackingUrl: result.trackingUrl,
              mode: result.mode,
              codAmount: result.codAmount || 0,
              weightGrams: result.weightGrams || 0,
              labelUrl: result.labelUrl || '',
            }
          : {
              provider: 'shiprocket',
              waybill: result.awb,
              shipmentId: result.shipmentId,
              srOrderId: result.srOrderId,
              courierName: result.courierName,
              trackingUrl: result.trackingUrl,
              mode: result.mode,
              codAmount: result.codAmount || 0,
              weightGrams: Math.round((result.weightKg || 0) * 1000),
              labelUrl: result.labelUrl || '',
            };
      await applyBooking(order, settings, shipment, wasShipped);
      booked.push({ orderNo: order.orderNo, awb: shipment.waybill, courierName: shipment.courierName || (isDel ? 'Delhivery' : isXb ? 'Xpressbees' : '') });
      if (!isDel && !isXb && result.shipmentId) shipmentIds.push(result.shipmentId);
    }

    // One clubbed pickup request for everything booked (Shiprocket auto-pickup only —
    // Xpressbees pickups ride on request_auto_pickup per booking).
    let pickupScheduled = false;
    if (!isDel && !isXb && shiprocket.shiprocketConfig(settings).autoPickup && shipmentIds.length) {
      const p = await shiprocket.schedulePickup(settings, shipmentIds);
      pickupScheduled = !!p.ok;
    }

    res.json({ success: true, data: { booked, failed, pickupScheduled } });
  })
);

// ADMIN — refresh a courier shipment's live status (any provider).
router.post(
  '/:id/sync-shipment',
  requireAdmin,
  validate({ params: Joi.object({ id: objectId.required() }) }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    const sh = order.shipment;
    if (!sh?.waybill || sh.provider === 'manual') throw ApiError.badRequest('No courier shipment on this order.');

    if (order.isTest) throw ApiError.badRequest('Simulated shipment — drive it with the Simulate buttons instead.');

    const settings = await getSettings();
    const isDel = sh.provider === 'delhivery';
    const isXb = sh.provider === 'xpressbees';
    const [t, l] = await Promise.all([
      isDel ? delhivery.trackShipment(settings, sh.waybill)
        : isXb ? xpressbees.trackShipment(settings, sh.waybill)
          : shiprocket.trackShipment(settings, sh.waybill),
      // Xpressbees labels come from the booking response — nothing to refresh.
      (sh.labelUrl || isXb)
        ? Promise.resolve({ ok: false })
        : (isDel ? delhivery.labelLink(settings, sh.waybill) : shiprocket.labelLink(settings, sh.shipmentId)),
    ]);
    if (t.ok) {
      order.shipment.status = t.status || sh.status;
      // Delhivery returns status type + location separately; Shiprocket/Xpressbees pre-join statusDetail.
      order.shipment.statusDetail = isDel
        ? [t.statusType, t.location].filter(Boolean).join(' · ')
        : (t.statusDetail || '');
    }
    // Auto-advance to Delivered when the courier confirms delivery. Payment flips
    // to paid ONLY for COD shipments — delivery of a prepaid-mode parcel says
    // nothing about money having been received (e.g. an unpaid-online order).
    if (t.ok && t.delivered && order.status === 'shipped') {
      order.status = 'delivered';
      if (order.paymentStatus === 'unpaid' && sh.mode === 'COD') order.paymentStatus = 'paid';
      await reconcileOrderStock(order);
    }
    if (l.ok) order.shipment.labelUrl = l.url;
    order.shipment.lastSyncedAt = new Date();
    await order.save();
    res.json({ success: true, data: order, meta: { synced: t.ok, error: t.ok ? null : t.error } });
  })
);

// ADMIN — cancel a courier shipment. With `revert:true` (one-click cleanup),
// also clears the shipment/tracking and moves a Shipped order back to Confirmed
// so it can be re-booked (used for test bookings + re-ship with another courier).
router.post(
  '/:id/cancel-shipment',
  requireAdmin,
  validate({
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({ revert: Joi.boolean().default(false) }).default({}),
  }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    const sh = order.shipment;
    if (!sh?.waybill || sh.provider === 'manual') throw ApiError.badRequest('No courier shipment on this order.');

    const settings = await getSettings();
    // Test orders carry a simulated shipment — nothing to cancel with a courier.
    const r = order.isTest ? { ok: true }
      : sh.provider === 'delhivery'
        ? await delhivery.cancelShipment(settings, sh.waybill)
        : sh.provider === 'xpressbees'
          ? await xpressbees.cancelShipment(settings, sh.waybill)
          : await shiprocket.cancelShipment(settings, sh.srOrderId);
    if (!r.ok) throw ApiError.badRequest(r.error || 'Courier could not cancel this shipment.');

    if (req.body.revert) {
      // Wipe the shipment + the auto-filled tracking note, and step the order
      // back to Confirmed (only from Shipped) so it's clean for re-booking.
      order.set('shipment', { provider: 'manual' });
      order.tracking.message = '';
      order.tracking.shippedAt = null;
      if (order.status === 'shipped') {
        order.status = 'confirmed';
        await reconcileOrderStock(order); // shipped→confirmed keeps stock reserved
      }
    } else {
      order.shipment.status = 'Cancelled';
      order.shipment.lastSyncedAt = new Date();
    }
    await order.save();
    res.json({ success: true, data: order });
  })
);

// ADMIN — get the shipping-label PDF link (any provider).
router.get(
  '/:id/label',
  requireAdmin,
  validate({ params: Joi.object({ id: objectId.required() }) }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    const sh = order.shipment;
    if (!sh?.waybill || sh.provider === 'manual') throw ApiError.badRequest('No courier shipment on this order.');

    if (order.isTest) throw ApiError.badRequest('Simulated shipment — no label exists for a test booking.');
    const settings = await getSettings();
    // Xpressbees hands the label out at booking time — serve the stored URL.
    if (sh.provider === 'xpressbees') {
      if (!sh.labelUrl) throw ApiError.badRequest('No label stored for this shipment — it should have arrived with the booking.');
      return res.json({ success: true, data: { url: sh.labelUrl } });
    }
    const r = sh.provider === 'delhivery'
      ? await delhivery.labelLink(settings, sh.waybill)
      : await shiprocket.labelLink(settings, sh.shipmentId);
    if (!r.ok) throw ApiError.badRequest(r.error || 'Label not ready yet. Try again in a moment.');
    if (order.shipment.labelUrl !== r.url) { order.shipment.labelUrl = r.url; await order.save(); }
    res.json({ success: true, data: { url: r.url } });
  })
);

// ADMIN — ONE merged PDF with the labels of many Shiprocket shipments (bulk
// print after a batch booking). Delhivery labels are per-waybill files, so
// Delhivery orders are skipped here — use the per-order Label button for those.
router.post(
  '/labels',
  requireAdmin,
  validate({ body: Joi.object({ ids: Joi.array().items(objectId).min(1).max(100).required() }) }),
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ _id: { $in: req.body.ids } });
    const shipmentIds = [];
    const skipped = [];
    for (const o of orders) {
      const sh = o.shipment;
      if (sh?.provider === 'shiprocket' && sh.shipmentId && sh.status !== 'Cancelled') {
        shipmentIds.push(sh.shipmentId);
      } else {
        skipped.push({
          orderNo: o.orderNo,
          reason: sh?.provider === 'delhivery' ? 'Delhivery — open its label from the order'
            : sh?.provider === 'xpressbees' ? 'Xpressbees — open its label from the order'
              : 'No Shiprocket shipment',
        });
      }
    }
    if (!shipmentIds.length) throw ApiError.badRequest('None of the selected orders has a Shiprocket shipment to print.');

    const settings = await getSettings();
    const r = await shiprocket.labelLink(settings, shipmentIds);
    if (!r.ok) throw ApiError.badRequest(r.error || 'Labels not ready yet. Try again in a moment.');
    res.json({ success: true, data: { url: r.url, count: shipmentIds.length, skipped } });
  })
);

// ADMIN — Shiprocket serviceability + courier options (pickup PIN → delivery PIN).
router.get(
  '/shiprocket/serviceability',
  requireAdmin,
  validate({ query: Joi.object({
    pin: Joi.string().pattern(/^\d{6}$/).required(),
    weight: Joi.number().min(0.01).max(50).optional(),
    cod: Joi.boolean().default(false),
  }) }),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const cfg = shiprocket.shiprocketConfig(settings);
    if (!cfg.pickupPin) throw ApiError.badRequest('Set the Shiprocket pickup PIN in Settings to check serviceability.');
    const r = await shiprocket.checkServiceability(settings, {
      pickupPin: cfg.pickupPin, deliveryPin: req.query.pin,
      weightKg: req.query.weight || cfg.defaultWeightKg, cod: req.query.cod,
    });
    if (!r.ok) throw ApiError.badRequest(r.error || 'Could not check serviceability');
    res.json({ success: true, data: r });
  })
);

// ADMIN — Delhivery pincode serviceability (COD/prepaid availability at a PIN),
// plus a Surface freight estimate when a weight is supplied (needs pickup PIN).
router.get(
  '/delhivery/serviceability',
  requireAdmin,
  validate({ query: Joi.object({
    pin: Joi.string().pattern(/^\d{6}$/).required(),
    weight: Joi.number().integer().min(1).max(50000).optional(), // grams
    cod: Joi.boolean().default(false),
  }) }),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const r = await delhivery.checkServiceability(settings, req.query.pin);
    if (!r.ok) throw ApiError.badRequest(r.error || 'Could not check serviceability');
    let rate = null;
    if (req.query.weight) {
      const rr = await delhivery.estimateRate(settings, { pin: req.query.pin, grams: req.query.weight, cod: req.query.cod });
      if (rr.ok) rate = rr.amount;
    }
    res.json({ success: true, data: { ...r, rate } });
  })
);

// ADMIN — Xpressbees serviceability + rate card (pickup PIN → delivery PIN).
// Returns their courier services with freight/COD/total charges, cheapest first;
// pass a service's `id` back as `courierId` when booking to force it.
router.get(
  '/xpressbees/serviceability',
  requireAdmin,
  validate({ query: Joi.object({
    pin: Joi.string().pattern(/^\d{6}$/).required(),
    weight: Joi.number().integer().min(1).max(50000).optional(), // grams
    cod: Joi.boolean().default(false),
    amount: Joi.number().min(0).optional(), // order value (rate inputs)
  }) }),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const r = await xpressbees.checkServiceability(settings, {
      deliveryPin: req.query.pin,
      weightGrams: req.query.weight,
      cod: req.query.cod,
      orderAmount: req.query.amount,
    });
    if (!r.ok) throw ApiError.badRequest(r.error || 'Could not check serviceability');
    res.json({ success: true, data: r });
  })
);

// PUBLIC (token-verified) — Shiprocket status webhook. Configure in Shiprocket →
// Settings → API → Webhooks with URL {site}/api/orders/courier-webhook and
// NOTE: Shiprocket forbids the words shiprocket/kartrocket/sr/kr in webhook
// URLs — hence the neutral path name.
// the x-api-key header set to settings.shiprocket.webhookToken. Shiprocket
// pushes every status change; when the courier confirms delivery the order
// auto-advances to Delivered (and COD flips to paid) — no Sync click needed.
// Shiprocket's dashboard VALIDATES the URL when you save it (a test ping,
// possibly without custom headers) and refuses the URL on any non-200 — so
// this endpoint always answers 200. Unauthorized calls are silently IGNORED
// (nothing is updated), which keeps spoofing harmless.
// The same endpoint also serves the Xpressbees status webhook — configured
// self-serve in their panel (Settings → Webhooks: name + this URL + a shared
// secret, status 0 = active). Xpressbees SIGNS each push instead of sending the
// secret: the `X-Hmac-SHA256` header is base64(HMAC-SHA256(raw body, secret)).
// We verify that signature against settings.xpressbees.webhookToken (the shared
// secret). Whichever auth matches decides which provider's shipments the push
// may touch, so one courier's credentials can never update another's orders.
// Payload: { awb_number, status, event_time, location, message, rto_awb }.
// They time out at 5s and auto-disable after 100 consecutive non-2xx — another
// reason this endpoint always answers 200 fast.
router.get('/courier-webhook', (_req, res) => res.json({ success: true }));
router.post(
  '/courier-webhook',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const got = String(req.headers['x-api-key'] || req.headers['x-webhook-token'] || '');
    const hmacSig = String(req.headers['x-hmac-sha256'] || '');
    const srToken = settings.shiprocket?.webhookToken || '';
    const xbToken = settings.xpressbees?.webhookToken || '';
    // No auth configured = webhook disabled; bad/missing auth = ACK but ignore.
    // Never process unauthenticated status pushes.
    // Shiprocket authenticates with a plain x-api-key (timing-safe compare);
    // Xpressbees ONLY via its HMAC signature — its shared secret must never be
    // accepted as a plain header (Xpressbees never sends it that way; accepting
    // it would just widen the forgery surface).
    const safeEq = (a, b) => {
      const ba = Buffer.from(String(a));
      const bb = Buffer.from(String(b));
      return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
    };
    let provider = (srToken && got && safeEq(got, srToken)) ? 'shiprocket' : null;
    if (!provider && xbToken && hmacSig && req.rawBody) {
      const expected = crypto.createHmac('sha256', xbToken).update(req.rawBody).digest('base64');
      if (safeEq(hmacSig, expected)) provider = 'xpressbees';
    }
    if (!provider) return res.json({ success: true, data: { ignored: true } });

    const b = req.body || {};
    const awb = String(b.awb || b.awb_code || b.awb_number || '').trim();
    const status = String(b.current_status || b.shipment_status || b.status || b.status_code || '').trim();
    if (!awb || !status) return res.json({ success: true, data: { ignored: true } });

    const order = await Order.findOne({ 'shipment.provider': provider, 'shipment.waybill': awb });
    if (!order) return res.json({ success: true, data: { ignored: true } }); // unknown AWB — ack anyway (no retries)

    const delivered = await applyCourierStatus(order, status, [b.current_status_body || b.message || '', b.location || b.current_location || ''].filter(Boolean).join(' · '));
    res.json({ success: true, data: { orderNo: order.orderNo, status, delivered } });
  })
);

// Apply a courier status update to an order — the ONE place the delivered rules
// live (used by the webhook above and the test-order simulator below, so the
// simulator exercises exactly the production transition logic).
// "Delivered" — but NOT "RTO Delivered" (parcel coming back) and NOT
// "Undelivered" (a FAILED delivery attempt; contains the substring). \b plus
// explicit exclusions. Xpressbees may push the short code "DLV".
// Payment flips to paid ONLY for COD-mode shipments.
async function applyCourierStatus(order, status, detail) {
  order.shipment.status = status;
  order.shipment.statusDetail = detail || '';
  order.shipment.lastSyncedAt = new Date();
  const delivered = (/\bdelivered\b/i.test(status) || /^dlv$/i.test(status)) && !/rto|undeliver|not[\s-]*deliver|non[\s-]*deliver/i.test(status);
  if (delivered && order.status === 'shipped') {
    order.status = 'delivered';
    if (order.paymentStatus === 'unpaid' && order.shipment.mode === 'COD') order.paymentStatus = 'paid';
    await reconcileOrderStock(order);
  }
  await order.save();
  return delivered;
}

// ADMIN — create a PRACTICE order (🧪) to rehearse the whole flow by hand.
// Rides the normal pipeline: shows in To Ship, can be confirmed, "shipped" with
// a simulated courier, walked through statuses, and finally deleted. Uses a
// synthetic line item (productId null) so stock is never touched, and the
// admin's own email so the customer emails land in YOUR inbox.
router.post(
  '/test-order',
  requireAdmin,
  validate({ body: Joi.object({ payment: Joi.string().valid('cod', 'prepaid').default('cod') }).default({}) }),
  asyncHandler(async (req, res) => {
    const prepaid = req.body.payment === 'prepaid';
    const order = new Order({
      orderNo: await nextOrderNo(),
      items: [{ productId: null, name: '🧪 Test item (not a real product)', image: '', price: 499, qty: 1 }],
      customer: { name: '🧪 TEST ORDER', phone: '9999999999', email: req.admin?.email || 'test@example.com' },
      address: { line1: '1 Test Street', line2: '', landmark: '', city: 'New Delhi', state: 'Delhi', pincode: '110001' },
      subtotal: 499, shipping: 0, codFee: 0, discount: 0, total: 499,
      channel: 'web',
      paymentMethod: prepaid ? 'razorpay' : 'cod',
      paymentStatus: prepaid ? 'paid' : 'unpaid',
      status: 'pending',
      stockApplied: true, // synthetic item — nothing to reserve
      isTest: true,
      notes: 'Practice order created from the admin panel. Simulate courier updates from the order drawer, then delete.',
    });
    await order.save();
    sendOrderConfirmation(order.toObject(), await getSettings())
      .then((r) => { if (!r.ok) console.error('[mailer] test-order email failed:', r.error); })
      .catch(() => {});
    res.status(201).json({ success: true, data: order });
  })
);

// ADMIN — drive a test order through the courier lifecycle by hand.
// action: 'book'    → fake shipment (TEST AWB, simulated courier) via the same
//                     applyBooking used by real bookings (sends the shipped email)
//         'status'  → apply a courier status through applyCourierStatus (the
//                     REAL webhook transition logic — Undelivered, Delivered,
//                     RTO etc. behave exactly as a live push would)
//         'delete'  → remove the practice order entirely
router.post(
  '/:id/simulate',
  requireAdmin,
  validate({
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      action: Joi.string().valid('book', 'status', 'delete').required(),
      status: Joi.string().max(60).when('action', { is: 'status', then: Joi.required() }),
    }),
  }),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    if (!order.isTest) throw ApiError.badRequest('Simulation is only allowed on 🧪 test orders.');

    if (req.body.action === 'delete') {
      await Order.deleteOne({ _id: order._id });
      return res.json({ success: true, data: { deleted: true } });
    }

    if (req.body.action === 'book') {
      if (order.shipment?.waybill) throw ApiError.badRequest(`Already booked (AWB ${order.shipment.waybill}). Cancel & reset first.`);
      if (!(await claimBookingSlot(order._id))) throw ApiError.badRequest('A booking for this order is already in progress.');
      const settings = await getSettings();
      const mode = xpressbees.orderPaymentMode(order);
      const wasShipped = order.status === 'shipped';
      await applyBooking(order, settings, {
        provider: 'xpressbees',
        waybill: `TEST${Date.now()}`,
        courierName: 'Simulated Courier',
        trackingUrl: '',
        mode,
        codAmount: mode === 'COD' ? Math.max(0, (order.total || 0) - (order.advancePaid || 0)) : 0,
        weightGrams: 200,
        labelUrl: '',
      }, wasShipped);
      return res.json({ success: true, data: order });
    }

    // action === 'status'
    if (!order.shipment?.waybill || !order.shipment.waybill.startsWith('TEST')) {
      throw ApiError.badRequest('Book the simulated shipment first.');
    }
    const delivered = await applyCourierStatus(order, req.body.status, 'Simulated status push');
    res.json({ success: true, data: order, meta: { delivered } });
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
