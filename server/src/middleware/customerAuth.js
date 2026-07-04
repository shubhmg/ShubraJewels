import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

// Customer tokens carry type:'customer' to keep them distinct from admin tokens.
export function signCustomer(customer) {
  return jwt.sign({ id: customer._id, email: customer.email, type: 'customer' }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

export function requireCustomer(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized('Please sign in'));
  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    if (decoded.type !== 'customer') return next(ApiError.unauthorized('Please sign in'));
    req.customer = decoded;
    next();
  } catch {
    next(ApiError.unauthorized('Session expired, please sign in again'));
  }
}

// Attaches req.customer if a valid customer token is present; never rejects.
export function optionalCustomer(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, env.jwt.secret);
      if (decoded.type === 'customer') req.customer = decoded;
    } catch { /* ignore */ }
  }
  next();
}
