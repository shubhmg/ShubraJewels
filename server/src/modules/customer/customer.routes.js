import express from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import env from '../../config/env.js';
import validate from '../../middleware/validate.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import { requireCustomer, signCustomer } from '../../middleware/customerAuth.js';
import Customer from './customer.model.js';
import Order from '../order/order.model.js';
import Review from '../review/review.model.js';

const router = express.Router();
const objectId = Joi.string().hex().length(24);

/* ── Email / password ─────────────────────────────────────────────── */
router.post(
  '/register',
  validate({
    body: Joi.object({
      name: Joi.string().max(120).allow('').default(''),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      phone: Joi.string().max(20).allow('').default(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    if (await Customer.findOne({ email })) throw ApiError.conflict('An account with this email already exists');
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const customer = await Customer.create({ name: req.body.name, email, phone: req.body.phone, passwordHash });
    res.status(201).json({ success: true, data: { token: signCustomer(customer), customer: customer.toPublic() } });
  })
);

router.post(
  '/login',
  validate({ body: Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() }) }),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const customer = await Customer.findOne({ email });
    if (!customer || !customer.passwordHash) throw ApiError.unauthorized('Invalid email or password');
    if (!(await bcrypt.compare(req.body.password, customer.passwordHash))) throw ApiError.unauthorized('Invalid email or password');
    res.json({ success: true, data: { token: signCustomer(customer), customer: customer.toPublic() } });
  })
);

/* ── Google sign-in ───────────────────────────────────────────────── */
router.post(
  '/google',
  validate({ body: Joi.object({ credential: Joi.string().required() }) }),
  asyncHandler(async (req, res) => {
    if (!env.googleClientId) throw ApiError.badRequest('Google sign-in is not configured');
    // Verify the ID token with Google (no extra dependency needed).
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(req.body.credential)}`);
    if (!resp.ok) throw ApiError.unauthorized('Google verification failed');
    const p = await resp.json();
    if (p.aud !== env.googleClientId) throw ApiError.unauthorized('Google token audience mismatch');
    if (p.email_verified !== 'true' && p.email_verified !== true) throw ApiError.unauthorized('Google email not verified');

    const email = p.email.toLowerCase();
    let customer = await Customer.findOne({ email });
    if (!customer) {
      customer = await Customer.create({ email, name: p.name || '', googleId: p.sub, avatar: p.picture || '' });
    } else if (!customer.googleId) {
      customer.googleId = p.sub;
      if (!customer.avatar && p.picture) customer.avatar = p.picture;
      await customer.save();
    }
    res.json({ success: true, data: { token: signCustomer(customer), customer: customer.toPublic() } });
  })
);

/* ── Profile ──────────────────────────────────────────────────────── */
router.get('/me', requireCustomer, asyncHandler(async (req, res) => {
  const c = await Customer.findById(req.customer.id);
  if (!c) throw ApiError.unauthorized('Account not found');
  res.json({ success: true, data: c.toPublic() });
}));

router.patch(
  '/me',
  requireCustomer,
  validate({
    body: Joi.object({
      name: Joi.string().max(120),
      phone: Joi.string().max(20).allow(''),
      address: Joi.object({
        line1: Joi.string().allow(''), line2: Joi.string().allow(''), city: Joi.string().allow(''),
        state: Joi.string().allow(''), pincode: Joi.string().allow(''),
      }),
    }).min(1),
  }),
  asyncHandler(async (req, res) => {
    const c = await Customer.findByIdAndUpdate(req.customer.id, req.body, { new: true });
    res.json({ success: true, data: c.toPublic() });
  })
);

/* ── Order history ────────────────────────────────────────────────── */
router.get('/orders', requireCustomer, asyncHandler(async (req, res) => {
  const orders = await Order.find({ customerId: req.customer.id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: orders });
}));

/* ── Post-purchase reviews ────────────────────────────────────────── */
// A customer may review a product only if they received it in a delivered
// order. One review per customer+product (re-submitting edits it). Verified
// reviews auto-publish; admin can hide later. Product ratings are computed
// from these on read (see product.routes.js).
router.get('/reviews', requireCustomer, asyncHandler(async (req, res) => {
  const reviews = await Review.find({ customerId: req.customer.id }).select('productId rating text').lean();
  res.json({ success: true, data: reviews });
}));

router.post(
  '/reviews',
  requireCustomer,
  validate({
    body: Joi.object({
      productId: objectId.required(),
      rating: Joi.number().integer().min(1).max(5).required(),
      text: Joi.string().allow('').max(1000).default(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { productId, rating, text } = req.body;

    // Verify a delivered order of this customer contains the product.
    const order = await Order.findOne({
      customerId: req.customer.id,
      status: 'delivered',
      'items.productId': productId,
    }).sort({ createdAt: -1 }).lean();
    if (!order) throw ApiError.forbidden('You can only review items from a delivered order');

    const customer = await Customer.findById(req.customer.id).lean();
    const review = await Review.findOneAndUpdate(
      { customerId: req.customer.id, productId },
      {
        name: customer?.name || 'Verified Buyer',
        rating,
        text,
        productId,
        customerId: req.customer.id,
        orderId: order._id,
        verifiedPurchase: true,
        isApproved: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, data: review });
  })
);

/* ── Cart sync (bag follows the customer) ─────────────────────────── */
router.put(
  '/cart',
  requireCustomer,
  validate({ body: Joi.object({ cart: Joi.array().items(Joi.object({ productId: objectId.required(), qty: Joi.number().min(1).required() })).required() }) }),
  asyncHandler(async (req, res) => {
    await Customer.findByIdAndUpdate(req.customer.id, { cart: req.body.cart });
    res.json({ success: true });
  })
);

export default router;
