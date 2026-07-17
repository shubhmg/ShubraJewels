import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

import env from './config/env.js';
import errorHandler from './middleware/errorHandler.js';
import { UPLOAD_DIR } from './middleware/upload.js';

import authRoutes from './modules/auth/auth.routes.js';
import settingRoutes from './modules/setting/setting.routes.js';
import categoryRoutes from './modules/category/category.routes.js';
import collectionRoutes from './modules/collection/collection.routes.js';
import productRoutes from './modules/product/product.routes.js';
import bannerRoutes from './modules/banner/banner.routes.js';
import videoRoutes from './modules/video/video.routes.js';
import reviewRoutes from './modules/review/review.routes.js';
import galleryRoutes from './modules/gallery/gallery.routes.js';
import orderRoutes from './modules/order/order.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import uploadRoutes from './modules/upload/upload.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import customerRoutes from './modules/customer/customer.routes.js';
import paymentRoutes from './modules/payment/payment.routes.js';
import couponRoutes from './modules/coupon/coupon.routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Behind Cloudflare + nginx — trust the first proxy so rate-limit / req.ip see
// the real client IP (X-Forwarded-For) instead of the proxy's.
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Default CSP blocks external images/media (img-src 'self'). We use uploaded
    // media (/uploads) + external URLs (Unsplash placeholders, admin-pasted links)
    // + Google Fonts, so allow https/data/blob for images, media, fonts & styles.
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'media-src': ["'self'", 'data:', 'blob:', 'https:'],
        'font-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https:'],
        'connect-src': ["'self'", 'https:'],
        'worker-src': ["'self'", 'blob:'],
        // Razorpay Checkout + Google Identity Services need external scripts + frames.
        'script-src': ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com', 'https://accounts.google.com', 'https://apis.google.com'],
        'frame-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com', 'https://accounts.google.com'],
        'child-src': ["'self'", 'https://checkout.razorpay.com'],
      },
    },
  })
);
app.use(compression());

// In production, restrict to the configured origin(s); dev reflects any origin.
const corsOrigin = env.nodeEnv === 'production'
  ? (env.corsOrigin ? env.corsOrigin.split(',').map((s) => s.trim()) : true)
  : true;
app.use(cors({ origin: corsOrigin }));

// Capture the raw body so the Razorpay webhook can verify its signature over
// the exact bytes (express.json otherwise discards them).
app.use(express.json({ limit: '5mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

// Rate limiting. Cheap in-memory limiter (single PM2 process). Skips /uploads
// (static) and the health check.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300, // generous per-IP/minute for normal browsing + admin
  standardHeaders: true,
  legacyHeaders: false,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12, // brute-force guard on admin/customer login
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // public writes: orders, tracking beacons, coupon checks
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Static uploads
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '30d',
  immutable: true,
}));

// Only rate-limit writes on shared route groups (leaves admin GET lists free).
const postOnly = (limiter) => (req, res, next) => (req.method === 'POST' ? limiter(req, res, next) : next());

app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/customer/login', loginLimiter);
app.use('/api/customer/register', loginLimiter);
app.use('/api/customer/check-email', loginLimiter);
app.use('/api/analytics/track', postOnly(writeLimiter));
app.use('/api/coupons/validate', writeLimiter);
app.use('/api/orders', postOnly(writeLimiter));

// Health check
app.get('/api/health', (_req, res) => {
  const healthy = mongoose.connection.readyState === 1;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    db: healthy ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/coupons', couponRoutes);

// In production, serve the built Vite app (dist/) for any non-API route.
const distDir = resolve(__dirname, '../../dist');
if (env.nodeEnv === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(resolve(distDir, 'index.html'));
  });
}

app.use(errorHandler);

export default app;
