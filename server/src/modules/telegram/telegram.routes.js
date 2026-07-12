import express from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import { getSettings } from '../setting/setting.model.js';
import Order from '../order/order.model.js';
import { tgApi } from '../../utils/notify.js';

const router = express.Router();

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Is this Telegram user/chat one of the owner's configured chat ids? Guards the
// buttons so only the owner (not a stranger who found the bot) can act.
function isAllowed(tg, id) {
  const ids = String(tg?.chatId || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.includes(String(id));
}

// Telegram webhook — receives inline-button taps (callback_query) for the
// "payment submitted" alerts. Verified via the secret token header set at
// registration (setWebhook secret_token). Always returns 200 so Telegram
// doesn't retry.
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const tg = settings.notifications?.telegram || {};
    const token = tg.botToken;

    // Verify the request really came from Telegram for OUR bot.
    const gotSecret = req.headers['x-telegram-bot-api-secret-token'] || '';
    if (!token || !tg.webhookSecret || gotSecret !== tg.webhookSecret) {
      return res.status(200).json({ ok: true }); // silently ignore spoofed/stale calls
    }

    const cb = req.body?.callback_query;
    if (!cb) return res.status(200).json({ ok: true });

    const fromId = cb.from?.id;
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const data = cb.data || '';

    const answer = (text) => tgApi(token, 'answerCallbackQuery', { callback_query_id: cb.id, text });

    // Only the owner's chats may act.
    if (!isAllowed(tg, fromId) && !isAllowed(tg, chatId)) {
      await answer('Not authorized.');
      return res.status(200).json({ ok: true });
    }

    const [action, orderId] = data.split(':');
    const order = orderId ? await Order.findById(orderId).catch(() => null) : null;
    if (!order) {
      await answer('Order not found (it may have been removed).');
      return res.status(200).json({ ok: true });
    }

    let note = '';
    if (action === 'pay') {
      order.paymentStatus = 'paid';
      order.expiresAt = null;
      if (!order.paymentVerifiedAt) order.paymentVerifiedAt = new Date();
      await order.save();
      note = '✅ Marked <b>PAID</b>';
      await answer('Marked paid ✅');
    } else if (action === 'cancel') {
      order.status = 'cancelled';
      order.expiresAt = null;
      await order.save();
      note = '✖ Order <b>CANCELLED</b>';
      await answer('Order cancelled');
    } else {
      await answer('Unknown action.');
      return res.status(200).json({ ok: true });
    }

    // Rewrite the original alert: keep the text, drop the buttons, stamp the result.
    const original = cb.message?.text ? esc(cb.message.text) : `Order ${esc(order.orderNo)}`;
    await tgApi(token, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      text: `${original}\n\n${note}`,
    });

    res.status(200).json({ ok: true });
  })
);

export default router;
