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
    const { theme, homepage, shipping, about, content, ...rest } = req.body || {};
    Object.assign(doc, rest);
    if (about && typeof about === 'object') {
      doc.about = about; // admin sends the full object (eyebrow, heading, image, paragraphs[], values[])
      doc.markModified('about');
    }
    if (content && typeof content === 'object') {
      doc.content = content; // nav, footer, page headings, buttons (see src/lib/siteContent.js)
      doc.markModified('content');
    }
    if (theme && typeof theme === 'object') {
      doc.theme = { ...doc.theme.toObject(), ...theme };
    }
    if (shipping && typeof shipping === 'object') {
      doc.shipping = shipping; // full object (cities[], defaultCharge, freeAboveSubtotal)
      doc.markModified('shipping');
    }
    if (homepage && typeof homepage === 'object') {
      doc.homepage = homepage; // admin editor sends the full object (hero + ordered sections)
      doc.markModified('homepage');
    }
    await doc.save();
    res.json({ success: true, data: doc });
  })
);

export default router;
