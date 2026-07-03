import express from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import validate from '../../middleware/validate.js';
import requireAdmin from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import AdminUser from './adminUser.model.js';

const router = express.Router();

router.post(
  '/login',
  validate({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const admin = await AdminUser.findOne({ email });
    if (!admin) throw ApiError.unauthorized('Invalid email or password');
    const ok = await bcrypt.compare(req.body.password, admin.passwordHash);
    if (!ok) throw ApiError.unauthorized('Invalid email or password');

    const token = jwt.sign({ id: admin._id, email: admin.email }, env.jwt.secret, {
      expiresIn: env.jwt.expiresIn,
    });
    res.json({ success: true, data: { token, admin: { id: admin._id, name: admin.name, email: admin.email } } });
  })
);

router.get(
  '/me',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const admin = await AdminUser.findById(req.admin.id).select('name email').lean();
    if (!admin) throw ApiError.unauthorized('Account not found');
    res.json({ success: true, data: admin });
  })
);

router.post(
  '/change-password',
  requireAdmin,
  validate({
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(6).required(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const admin = await AdminUser.findById(req.admin.id);
    if (!admin) throw ApiError.unauthorized('Account not found');
    const ok = await bcrypt.compare(req.body.currentPassword, admin.passwordHash);
    if (!ok) throw ApiError.badRequest('Current password is incorrect');
    admin.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    await admin.save();
    res.json({ success: true });
  })
);

export default router;
