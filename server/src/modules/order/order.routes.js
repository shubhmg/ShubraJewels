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
import { sendOrderConfirmation, sendOrderShipped, sendOrderCancelled } from '../../utils/mailer.js';
import { reconcileOrderStock, checkAvailability, reserveProducts, releaseProducts } from './orderStock.js';
import * as shiprocket from '../../utils/shiprocket.js';
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
function shipmentTrackingMessage(_provider, waybill, url) {
  return `Shipped via Shiprocket. Tracking ID: ${waybill}\nTrack your parcel: ${url}`;
}

// Book with a courier, retrying with a fresh order reference when the courier
// rejects a re-used one. Couriers key on the order id and refuse it even after a
// cancel, so re-books send `{orderNo}-R{n}`. Returns { result, attempt }.
async function bookWithRetry(order, bookFn) {
  const base = order.orderNo;
  const mkRef = (n) => (n <= 1 ? base : `${base}-R${n}`);
  const dup = (e) => /already (assigned|exist|manifest)|duplicate|order.*(exist|already)/i.test(e || '');
  let attempt = (order.shipmentAttempts || 0) + 1;
  let result = await bookFn(mkRef(attempt));
  let guard = 0;
  while (!result.ok && dup(result.error) && guard < 6) {
    attempt += 1; guard += 1;
    result = await bookFn(mkRef(attempt));
  }
  return { result, attempt };
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
    body: Joi.object({ weight: Joi.number().min(0.01).max(50).optional() }).default({}), // kg
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
    const { result, attempt } = await bookWithRetry(order, (ref) =>
      shiprocket.createShipment(settings, order.toObject(), { weightKg: req.body.weight, orderRef: ref }));
    if (!result.ok) throw ApiError.badRequest(result.error || 'Shiprocket could not book this shipment.');

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

// ADMIN — bulk-book Shiprocket for many orders at once. Uses the default
// weight (defaultWeightKg × qty) per order, books sequentially (avoids courier
// assignment races/rate limits), then clubs ONE pickup request for the whole
// batch when auto-pickup is on. Partial success is normal: failures are
// returned per order and those orders stay untouched in To Ship.
router.post(
  '/bulk-ship',
  requireAdmin,
  validate({ body: Joi.object({ ids: Joi.array().items(objectId).min(1).max(50).required() }) }),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const cfg = shiprocket.shiprocketConfig(settings);
    if (!shiprocket.shiprocketReady(cfg)) {
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

      const { result, attempt } = await bookWithRetry(order, (ref) =>
        shiprocket.createShipment(settings, order.toObject(), { orderRef: ref, skipPickup: true }));
      if (!result.ok) { failed.push({ orderNo: order.orderNo, error: result.error || 'Booking failed' }); continue; }

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
      booked.push({ orderNo: order.orderNo, awb: result.awb, courierName: result.courierName });
      if (result.shipmentId) shipmentIds.push(result.shipmentId);
    }

    // One clubbed pickup request for everything booked (auto-pickup only).
    let pickupScheduled = false;
    if (cfg.autoPickup && shipmentIds.length) {
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

    const settings = await getSettings();
    const [t, l] = await Promise.all([
      shiprocket.trackShipment(settings, sh.waybill),
      sh.labelUrl ? Promise.resolve({ ok: false }) : shiprocket.labelLink(settings, sh.shipmentId),
    ]);
    if (t.ok) { order.shipment.status = t.status || sh.status; order.shipment.statusDetail = t.statusDetail || ''; }
    // Auto-advance to Delivered when the courier confirms delivery.
    if (t.ok && t.delivered && order.status === 'shipped') {
      order.status = 'delivered';
      if (order.paymentStatus === 'unpaid') order.paymentStatus = 'paid';
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
    const r = await shiprocket.cancelShipment(settings, sh.srOrderId);
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

    const settings = await getSettings();
    const r = await shiprocket.labelLink(settings, sh.shipmentId);
    if (!r.ok) throw ApiError.badRequest(r.error || 'Label not ready yet. Try again in a moment.');
    if (order.shipment.labelUrl !== r.url) { order.shipment.labelUrl = r.url; await order.save(); }
    res.json({ success: true, data: { url: r.url } });
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
router.get('/courier-webhook', (_req, res) => res.json({ success: true }));
router.post(
  '/courier-webhook',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const expected = settings.shiprocket?.webhookToken || '';
    const got = req.headers['x-api-key'] || req.headers['x-webhook-token'] || '';
    // No token configured = webhook disabled; wrong/missing token = ACK but
    // ignore. Never process unauthenticated status pushes.
    if (!expected || got !== expected) return res.json({ success: true, data: { ignored: true } });

    const b = req.body || {};
    const awb = String(b.awb || b.awb_code || '').trim();
    const status = String(b.current_status || b.shipment_status || b.status || '').trim();
    if (!awb || !status) return res.json({ success: true, data: { ignored: true } });

    const order = await Order.findOne({ 'shipment.provider': 'shiprocket', 'shipment.waybill': awb });
    if (!order) return res.json({ success: true, data: { ignored: true } }); // unknown AWB — ack anyway (no retries)

    order.shipment.status = status;
    order.shipment.statusDetail = [b.current_status_body || '', b.location || b.current_location || ''].filter(Boolean).join(' · ');
    order.shipment.lastSyncedAt = new Date();

    // "Delivered" (but NOT "RTO Delivered" — that's the parcel coming back to us).
    const delivered = /delivered/i.test(status) && !/rto/i.test(status);
    if (delivered && order.status === 'shipped') {
      order.status = 'delivered';
      if (order.paymentStatus === 'unpaid') order.paymentStatus = 'paid';
      await reconcileOrderStock(order);
    }
    await order.save();
    res.json({ success: true, data: { orderNo: order.orderNo, status, delivered } });
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
