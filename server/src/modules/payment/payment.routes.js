import express from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import env from '../../config/env.js';
import validate from '../../middleware/validate.js';
import { optionalCustomer } from '../../middleware/customerAuth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import Order from '../order/order.model.js';
import Coupon from '../coupon/coupon.model.js';
import PaymentIntent from './paymentIntent.model.js';
import { getSettings } from '../setting/setting.model.js';
import { resolveCoupon } from '../coupon/coupon.service.js';
import { resolveItems } from '../../utils/resolveItems.js';
import { computeCharges } from '../../utils/pricing.js';
import { nextOrderNo } from '../../utils/sequence.js';
import { sendTelegram, orderMessage, orderPhoto } from '../../utils/notify.js';

const router = express.Router();
const objectId = Joi.string().hex().length(24);

const rzp = env.razorpay.keyId && env.razorpay.keySecret
  ? new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret })
  : null;

// Constant-time comparison of two hex signatures.
function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

const itemsSchema = Joi.array()
  .items(Joi.object({ productId: objectId.required(), qty: Joi.number().min(1).required() }))
  .min(1)
  .required();

const customerSchema = Joi.object({
  name: Joi.string().max(120).required(),
  phone: Joi.string().max(20).required(),
  email: Joi.string().email().allow('').default(''),
});
const addressSchema = Joi.object({
  line1: Joi.string().allow('').max(200), line2: Joi.string().allow('').max(200), landmark: Joi.string().allow('').max(120),
  city: Joi.string().allow('').max(80), state: Joi.string().allow('').max(80), pincode: Joi.string().allow('').max(12),
});

// Full server-side pricing: subtotal + shipping − validated discount.
async function priceOrder({ items, address, couponCode }) {
  const priced = await resolveItems(items);
  const settings = await getSettings();
  // Razorpay is prepaid — gets free shipping when that reward is enabled.
  const { shipping } = computeCharges(settings, address || {}, 'razorpay', priced.subtotal);
  let discount = 0;
  let coupon = null;
  if (couponCode) {
    const r = await resolveCoupon(couponCode, priced.subtotal);
    if (r.error) throw ApiError.badRequest(r.error);
    discount = r.discount;
    coupon = r.coupon;
  }
  const total = Math.max(0, priced.subtotal + shipping - discount);
  return { ...priced, shipping, discount, coupon, couponCode: coupon?.code || '', total };
}

// Create the order from a stored intent exactly once. Safe to call from both
// /verify and the webhook — the unique razorpayPaymentId index + intent status
// guarantee a single order. Returns the (new or existing) order.
async function finalizeIntent(intent, paymentId) {
  if (intent.status === 'completed' && intent.orderId) {
    const existing = await Order.findById(intent.orderId);
    if (existing) return existing;
  }
  // Guard against a concurrent finalize (webhook + browser at once).
  const dup = await Order.findOne({ razorpayPaymentId: paymentId });
  if (dup) return dup;

  let order;
  try {
    order = await Order.create({
      orderNo: await nextOrderNo(),
      customerId: intent.customerId || null,
      items: intent.items,
      customer: intent.customer,
      address: intent.address || {},
      subtotal: intent.subtotal,
      shipping: intent.shipping,
      discount: intent.discount,
      couponCode: intent.couponCode,
      total: intent.total,
      channel: 'web',
      notes: intent.notes || '',
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      razorpayOrderId: intent.razorpayOrderId,
      razorpayPaymentId: paymentId,
    });
  } catch (e) {
    // Lost a race — another finalize already created it.
    if (e.code === 11000) return Order.findOne({ razorpayPaymentId: paymentId });
    throw e;
  }

  if (intent.couponId) await Coupon.updateOne({ _id: intent.couponId }, { $inc: { usedCount: 1 } });
  intent.status = 'completed';
  intent.orderId = order._id;
  await intent.save();

  // Notify the owner of the new (paid) online order — best-effort.
  getSettings().then((s) => sendTelegram(s, orderMessage(order), { photo: orderPhoto(order) })).catch(() => {});

  return order;
}

// STEP 1 — create a Razorpay order (amount computed server-side, in paise) and
// snapshot the priced order as a PaymentIntent so it can be finalized once.
router.post(
  '/create-order',
  optionalCustomer,
  validate({
    body: Joi.object({
      items: itemsSchema,
      customer: customerSchema.required(),
      address: addressSchema.default({}),
      city: Joi.string().allow('').max(80).default(''),
      couponCode: Joi.string().allow('').max(40).default(''),
      notes: Joi.string().allow('').max(1000).default(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!rzp) throw ApiError.badRequest('Online payments are not configured');
    const priced = await priceOrder({ items: req.body.items, address: req.body.address || {}, couponCode: req.body.couponCode });
    const amount = Math.round(priced.total * 100);
    if (amount < 100) throw ApiError.badRequest('Amount must be at least ₹1');

    let order;
    try {
      order = await rzp.orders.create({ amount, currency: 'INR', receipt: `rcpt_${Date.now()}` });
    } catch (e) {
      throw ApiError.internal(`Payment gateway error: ${e?.error?.description || e.message}`);
    }

    await PaymentIntent.create({
      razorpayOrderId: order.id,
      items: priced.items,
      customer: req.body.customer,
      address: req.body.address || {},
      customerId: req.customer?.id || null,
      subtotal: priced.subtotal,
      shipping: priced.shipping,
      discount: priced.discount,
      couponCode: priced.couponCode,
      couponId: priced.coupon?._id || null,
      total: priced.total,
      notes: req.body.notes || '',
    });

    res.json({ success: true, data: { orderId: order.id, amount: order.amount, currency: order.currency, keyId: env.razorpay.keyId } });
  })
);

// STEP 3 — verify the signature (browser callback); finalize the stored intent.
router.post(
  '/verify',
  optionalCustomer,
  validate({
    body: Joi.object({
      razorpay_order_id: Joi.string().required(),
      razorpay_payment_id: Joi.string().required(),
      razorpay_signature: Joi.string().required(),
      // Legacy fields still accepted from the client but no longer trusted —
      // the order is rebuilt from the server-side PaymentIntent.
      items: itemsSchema.optional(),
      customer: customerSchema.optional(),
      address: addressSchema.optional(),
      couponCode: Joi.string().allow('').max(40).optional(),
      notes: Joi.string().allow('').max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!rzp) throw ApiError.badRequest('Online payments are not configured');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expected = crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (!safeEqualHex(expected, razorpay_signature)) throw ApiError.badRequest('Payment signature verification failed');

    const intent = await PaymentIntent.findOne({ razorpayOrderId: razorpay_order_id });
    if (!intent) throw ApiError.badRequest('Payment session not found — please contact us if money was deducted');

    const order = await finalizeIntent(intent, razorpay_payment_id);
    res.status(201).json({ success: true, data: order });
  })
);

// WEBHOOK — Razorpay server-to-server backstop. Fires even if the browser dies
// after capture, so the order is never lost. Verifies the webhook signature
// over the RAW body (captured in app.js as req.rawBody). No-op until
// RAZORPAY_WEBHOOK_SECRET is configured.
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const secret = env.razorpay.webhookSecret;
    if (!secret) return res.status(200).json({ ok: true, skipped: 'no webhook secret' });

    const signature = req.headers['x-razorpay-signature'] || '';
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (!safeEqualHex(expected, signature)) return res.status(400).json({ ok: false });

    const event = req.body?.event;
    const entity = req.body?.payload?.payment?.entity;
    if ((event === 'payment.captured' || event === 'order.paid') && entity?.order_id) {
      const intent = await PaymentIntent.findOne({ razorpayOrderId: entity.order_id });
      if (intent) await finalizeIntent(intent, entity.id);
    }
    // Always 200 so Razorpay stops retrying.
    res.status(200).json({ ok: true });
  })
);

export default router;
