import express from 'express';
import requireAdmin from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { getSettings } from './setting.model.js';
import { sendTelegram } from '../../utils/notify.js';
import { ensureToken as ensureShiprocketToken } from '../../utils/shiprocket.js';
import { checkServiceability as delhiveryServiceability } from '../../utils/delhivery.js';

const router = express.Router();

// Public: current settings. SECRETS (the Telegram bot token, the Shiprocket
// credentials, the Delhivery API token) are stripped so they never reach the
// storefront.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const doc = await getSettings();
    const obj = doc.toObject();
    delete obj.notifications;
    delete obj.shiprocket; // courier config incl. email/password/JWT — admin-only
    delete obj.delhivery;  // courier config incl. API token — admin-only
    res.json({ success: true, data: obj });
  })
);

// Admin: full settings incl. secrets, for the settings editor.
router.get(
  '/admin',
  requireAdmin,
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
    const { theme, homepage, shipping, about, content, notifications, shiprocket, delhivery, ...rest } = req.body || {};
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
    if (notifications && typeof notifications === 'object') {
      // Deep-merge so partial updates (e.g. just toggling enabled) keep the token.
      const cur = doc.notifications?.toObject?.() || doc.notifications || {};
      doc.notifications = {
        ...cur,
        telegram: { ...(cur.telegram || {}), ...(notifications.telegram || {}) },
      };
      doc.markModified('notifications');
    }
    if (shiprocket && typeof shiprocket === 'object') {
      const cur = doc.shiprocket?.toObject?.() || doc.shiprocket || {};
      const next = { ...cur, ...shiprocket };
      // If the login credentials changed, drop the cached JWT so it re-logs in.
      if ((shiprocket.email && shiprocket.email !== cur.email) || (shiprocket.password && shiprocket.password !== cur.password)) {
        next.token = '';
        next.tokenExpiry = null;
      }
      doc.shiprocket = next;
      doc.markModified('shiprocket');
    }
    if (delhivery && typeof delhivery === 'object') {
      // Deep-merge so a partial update (e.g. toggling the policy) keeps the token.
      const cur = doc.delhivery?.toObject?.() || doc.delhivery || {};
      doc.delhivery = { ...cur, ...delhivery };
      doc.markModified('delhivery');
    }
    if (homepage && typeof homepage === 'object') {
      doc.homepage = homepage; // admin editor sends the full object (hero + ordered sections)
      doc.markModified('homepage');
    }
    await doc.save();
    const obj = doc.toObject();
    delete obj.notifications;
    delete obj.shiprocket;
    delete obj.delhivery;
    res.json({ success: true, data: obj });
  })
);

// Admin: send a test Telegram message to verify the bot token + chat id.
router.post(
  '/test-telegram',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const doc = await getSettings();
    const r = await sendTelegram(doc, '✅ Test alert from Shubra Jewels — order notifications are working.');
    if (!r.ok) return res.status(400).json({ success: false, message: r.error || 'Could not send. Check the token and chat id.' });
    res.json({ success: true, data: { sent: true } });
  })
);

// Admin: verify the Delhivery token by hitting the serviceability endpoint with
// a known PIN (defaults to the pickup PIN, else 110001 New Delhi).
router.post(
  '/test-delhivery',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const doc = await getSettings();
    const pin = String(req.body?.pin || doc.delhivery?.pickupPin || '110001').trim();
    const r = await delhiveryServiceability(doc, pin);
    if (!r.ok) return res.status(400).json({ success: false, message: r.error || 'Delhivery check failed. Verify the API token.' });
    res.json({ success: true, data: { pin, ...r } });
  })
);

// Admin: verify Shiprocket credentials by logging in (mints + caches the JWT).
router.post(
  '/test-shiprocket',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const doc = await getSettings();
    const r = await ensureShiprocketToken(doc);
    if (!r.ok) return res.status(400).json({ success: false, message: r.error || 'Shiprocket login failed. Check the email and API password.' });
    res.json({ success: true, data: { loggedIn: true } });
  })
);

export default router;
