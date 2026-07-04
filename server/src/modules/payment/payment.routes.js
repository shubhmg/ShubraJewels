import express from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import env from '../../config/env.js';
import validate from '../../middleware/validate.js';
import { optionalCustomer } from '../../middleware/customerAuth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import Product from '../product/product.model.js';
import Order from '../order/order.model.js';

const router = express.Router();
const objectId = Joi.string().hex().length(24);

const rzp = env.razorpay.keyId && env.razorpay.keySecret
  ? new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret })
  : null;

// Rebuild items + subtotal from the DB — never trust client-sent prices/amounts.
async function priceItems(reqItems) {
  const ids = reqItems.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const map = new Map(products.map((p) => [String(p._id), p]));
  const items = reqItems.map((i) => {
    const p = map.get(String(i.productId));
    if (!p) throw ApiError.badRequest('One or more products are no longer available');
    return { productId: p._id, name: p.name, image: p.images?.[0] || '', price: p.price, qty: i.qty };
  });
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  return { items, subtotal };
}

async function nextOrderNo() {
  const yy = new Date().getFullYear();
  const count = await Order.countDocuments();
  return `SJ-${yy}-${String(count + 1).padStart(5, '0')}`;
}

const itemsSchema = Joi.array()
  .items(Joi.object({ productId: objectId.required(), qty: Joi.number().min(1).required() }))
  .min(1)
  .required();

// STEP 1 — create a Razorpay order (amount computed server-side, in paise).
router.post(
  '/create-order',
  validate({ body: Joi.object({ items: itemsSchema }) }),
  asyncHandler(async (req, res) => {
    if (!rzp) throw ApiError.badRequest('Online payments are not configured');
    const { subtotal } = await priceItems(req.body.items);
    const amount = Math.round(subtotal * 100);
    if (amount < 100) throw ApiError.badRequest('Amount must be at least ₹1');

    let order;
    try {
      order = await rzp.orders.create({ amount, currency: 'INR', receipt: `rcpt_${Date.now()}` });
    } catch (e) {
      throw ApiError.internal(`Payment gateway error: ${e?.error?.description || e.message}`);
    }
    res.json({ success: true, data: { orderId: order.id, amount: order.amount, currency: order.currency, keyId: env.razorpay.keyId } });
  })
);

// STEP 3 — verify the signature; only then persist a PAID order.
router.post(
  '/verify',
  optionalCustomer,
  validate({
    body: Joi.object({
      razorpay_order_id: Joi.string().required(),
      razorpay_payment_id: Joi.string().required(),
      razorpay_signature: Joi.string().required(),
      items: itemsSchema,
      customer: Joi.object({
        name: Joi.string().max(120).required(),
        phone: Joi.string().max(20).required(),
        email: Joi.string().email().allow('').default(''),
      }).required(),
      address: Joi.object({
        line1: Joi.string().allow('').max(200), line2: Joi.string().allow('').max(200),
        city: Joi.string().allow('').max(80), state: Joi.string().allow('').max(80), pincode: Joi.string().allow('').max(12),
      }).default({}),
      notes: Joi.string().allow('').max(1000),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!rzp) throw ApiError.badRequest('Online payments are not configured');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expected = crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) throw ApiError.badRequest('Payment signature verification failed');

    const { items, subtotal } = await priceItems(req.body.items);
    const order = await Order.create({
      orderNo: await nextOrderNo(),
      customerId: req.customer?.id || null,
      items,
      customer: req.body.customer,
      address: req.body.address || {},
      subtotal,
      shipping: 0,
      total: subtotal,
      channel: 'web',
      notes: req.body.notes || '',
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });
    res.status(201).json({ success: true, data: order });
  })
);

export default router;
