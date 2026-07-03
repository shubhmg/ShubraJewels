import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

/**
 * Requires a valid admin JWT (Authorization: Bearer <token>).
 * Single-shop: any valid token is an admin.
 */
export default function requireAdmin(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized('Login required'));
  try {
    req.admin = jwt.verify(token, env.jwt.secret);
    next();
  } catch {
    next(ApiError.unauthorized('Session expired, please log in again'));
  }
}
