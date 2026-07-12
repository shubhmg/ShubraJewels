import express from 'express';
import crypto from 'crypto';
import requireAdmin from '../../middleware/auth.js';
import asyncHandler from '../../utils/asyncHandler.js';
import env from '../../config/env.js';
import { getSettings } from './setting.model.js';
import { sendTelegram, setTelegramWebhook, deleteTelegramWebhook } from '../../utils/notify.js';

const router = express.Router();

// Public base URL for the Telegram webhook (Cloudflare/nginx → this server).
const publicBase = () => (env.publicUrl || 'https://shubrajewels.shop').replace(/\/$/, '');

// Register (or tear down) the bot webhook so inline button taps reach us.
// Ensures a webhook secret exists. Best-effort; mutates + saves the doc.
async function syncTelegramWebhook(doc) {
  const tg = doc.notifications?.telegram;
  if (!tg) return;
  if (tg.enabled && tg.botToken) {
    if (!tg.webhookSecret) {
      tg.webhookSecret = crypto.randomBytes(16).toString('hex');
      doc.markModified('notifications');
      await doc.save();
    }
    await setTelegramWebhook(tg.botToken, `${publicBase()}/api/telegram/webhook`, tg.webhookSecret);
  } else if (tg.botToken) {
    await deleteTelegramWebhook(tg.botToken);
  }
}

// Public: current settings. SECRETS (notifications.telegram — the bot token)
// are stripped so they never reach the storefront.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const doc = await getSettings();
    const obj = doc.toObject();
    delete obj.notifications;
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
    const { theme, homepage, shipping, about, content, notifications, ...rest } = req.body || {};
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
    if (homepage && typeof homepage === 'object') {
      doc.homepage = homepage; // admin editor sends the full object (hero + ordered sections)
      doc.markModified('homepage');
    }
    await doc.save();
    // Keep the Telegram webhook in sync whenever notification config changes.
    if (notifications && typeof notifications === 'object') await syncTelegramWebhook(doc).catch(() => {});
    const obj = doc.toObject();
    delete obj.notifications;
    res.json({ success: true, data: obj });
  })
);

// Admin: send a test Telegram message to verify the bot token + chat id.
router.post(
  '/test-telegram',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const doc = await getSettings();
    await syncTelegramWebhook(doc).catch(() => {}); // ensure buttons work too
    const r = await sendTelegram(doc, '✅ Test alert from Shubra Jewels — order notifications are working. Payment-verify buttons are active.');
    if (!r.ok) return res.status(400).json({ success: false, message: r.error || 'Could not send. Check the token and chat id.' });
    res.json({ success: true, data: { sent: true } });
  })
);

export default router;
