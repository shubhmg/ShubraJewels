import express from 'express';
import requireAdmin from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { getSettings } from './setting.model.js';

const router = express.Router();

// Public: current settings
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const doc = await getSettings();
    res.json({ success: true, data: doc });
  })
);

// Admin: update (partial). Theme is merged so a single colour can be changed.
router.patch(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const doc = await getSettings();
    const { theme, ...rest } = req.body || {};
    Object.assign(doc, rest);
    if (theme && typeof theme === 'object') {
      doc.theme = { ...doc.theme.toObject(), ...theme };
    }
    await doc.save();
    res.json({ success: true, data: doc });
  })
);

export default router;
