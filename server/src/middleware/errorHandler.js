import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';

export default function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: 'Validation error', details: messages });
  }

  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${fields.join(', ') || 'unique field'}`,
      ...(err.keyValue ? { details: err.keyValue } : {}),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid value for ${err.path}` });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  console.error('Unhandled error:', err);
  const showDetails = env.nodeEnv !== 'production';
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(showDetails ? { details: err.message } : {}),
  });
}
