import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
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

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors({ origin: env.nodeEnv === 'production' ? (process.env.CORS_ORIGIN || true) : true }));
app.use(express.json({ limit: '5mb' }));

// Static uploads
app.use('/uploads', express.static(UPLOAD_DIR));

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
