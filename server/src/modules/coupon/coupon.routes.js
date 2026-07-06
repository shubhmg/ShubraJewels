import express from 'express';
import Joi from 'joi';
import Coupon from './coupon.model.js';
import validate from '../../middleware/validate.js';
import requireAdmin from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import { resolveCoupon } from './coupon.service.js';

const router = express.Router();
const objectId = Joi.string().hex().length(24);

// PUBLIC — validate a code against a subtotal (used by checkout).
router.post(
  '/validate',
  validate({ body: Joi.object({ code: Joi.string().required().max(40), subtotal: Joi.number().min(0).required() }) }),
  asyncHandler(async (req, res) => {
    const { discount, coupon, error } = await resolveCoupon(req.body.code, req.body.subtotal);
    if (error) throw ApiError.badRequest(error);
    res.json({ success: true, data: { code: coupon.code, type: coupon.type, value: coupon.value, discount } });
  })
);

const base = {
  code: Joi.string().max(40),
  type: Joi.string().valid('percent', 'flat'),
  value: Joi.number().min(0),
  minSubtotal: Joi.number().min(0),
  maxDiscount: Joi.number().min(0),
  expiresAt: Joi.date().allow(null, ''),
  usageLimit: Joi.number().min(0),
  isActive: Joi.boolean(),
};

// ADMIN — list / create / update / delete
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Coupon.find().sort({ createdAt: -1 }).lean() });
}));

router.post(
  '/',
  requireAdmin,
  validate({ body: Joi.object({ ...base, code: base.code.required(), value: base.value.required() }) }),
  asyncHandler(async (req, res) => {
    const code = req.body.code.toUpperCase().trim();
    if (await Coupon.findOne({ code })) throw ApiError.conflict('A coupon with this code already exists');
    const c = await Coupon.create({ ...req.body, code, expiresAt: req.body.expiresAt || null });
    res.status(201).json({ success: true, data: c });
  })
);

router.patch(
  '/:id',
  requireAdmin,
  validate({ params: Joi.object({ id: objectId.required() }), body: Joi.object(base).min(1) }),
  asyncHandler(async (req, res) => {
    const patch = { ...req.body };
    if (patch.code) patch.code = patch.code.toUpperCase().trim();
    if (patch.expiresAt === '' ) patch.expiresAt = null;
    const c = await Coupon.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!c) throw ApiError.notFound('Coupon not found');
    res.json({ success: true, data: c });
  })
);

router.delete(
  '/:id',
  requireAdmin,
  validate({ params: Joi.object({ id: objectId.required() }) }),
  asyncHandler(async (req, res) => {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  })
);

export default router;
