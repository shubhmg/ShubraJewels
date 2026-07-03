import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * Attaches req.admin if a valid token is present, but never rejects.
 * Lets a single GET route serve both public (active-only) and admin (all) views.
 */
export default function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try { req.admin = jwt.verify(token, env.jwt.secret); } catch { /* ignore */ }
  }
  next();
}
