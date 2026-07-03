import express from 'express';
import requireAdmin from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { seedContent, clearContent } from './seed.service.js';

const router = express.Router();

// Fill empty collections with sample content (safe). ?force=1 wipes + reseeds.
router.post(
  '/seed',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const force = req.query.force === '1' || req.body?.force === true;
    const summary = await seedContent({ force });
    res.json({ success: true, data: { seeded: summary } });
  })
);

// Delete ALL content (products, categories, collections, banners, videos,
// reviews, gallery). Keeps orders, settings, and your admin login.
router.post(
  '/clear',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const removed = await clearContent();
    res.json({ success: true, data: { cleared: removed } });
  })
);

export default router;
