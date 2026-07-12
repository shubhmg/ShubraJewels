// Telegram order notifications. Config lives in the Settings doc
// (notifications.telegram) so the store owner manages it from the admin panel.
// All sends are best-effort: failures are logged, never thrown, so a bad token
// can't break order placement.

import env from '../config/env.js';

const BASE = (env.publicUrl || 'https://shubrajewels.shop').replace(/\/$/, '');

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Make a stored image path absolute so Telegram can fetch it.
const absUrl = (p) => (!p ? '' : /^https?:\/\//.test(p) ? p : `${BASE}${p.startsWith('/') ? '' : '/'}${p}`);

// First product image in the order (absolute URL), or '' if none.
export function orderPhoto(order) {
  const withImg = (order?.items || []).find((it) => it.image);
  return withImg ? absUrl(withImg.image) : '';
}

// Unique product images in the order (absolute URLs), capped at Telegram's
// 10-per-album limit.
export function orderPhotos(order) {
  const seen = new Set();
  const urls = [];
  for (const it of order?.items || []) {
    if (!it.image) continue;
    const u = absUrl(it.image);
    if (seen.has(u)) continue;
    seen.add(u);
    urls.push(u);
    if (urls.length >= 10) break;
  }
  return urls;
}

// Low-level Telegram Bot API call. Best-effort; returns the parsed body or null.
export async function tgApi(token, method, payload) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return await res.json().catch(() => null);
  } catch (e) {
    return { ok: false, description: e.message || 'network error' };
  }
}

// Send an HTML message to every configured chat id, with an optional inline
// keyboard (replyMarkup) and optional product images.
//   - `photos` (2+): a compact thumbnail-grid album is sent first, then the
//     text + buttons as a follow-up message (albums can't carry buttons).
//   - `photos` (1) or `photo`: a single photo with the text as its caption.
//   - none: a plain text message.
// The text message is always attempted independently, so a bad image URL can
// never swallow the order. Returns { ok, error }.
export async function sendTelegram(settings, text, { replyMarkup, photo, photos } = {}) {
  const tg = settings?.notifications?.telegram || {};
  if (!tg.enabled || !tg.botToken || !tg.chatId) return { ok: false, error: 'not configured' };

  const chatIds = String(tg.chatId).split(',').map((s) => s.trim()).filter(Boolean);
  const imgs = (photos && photos.length ? photos : (photo ? [photo] : [])).slice(0, 10);
  const token = tg.botToken;
  let lastError = null;
  let anyOk = false;

  const sendText = (chatId) => tgApi(token, 'sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });

  for (const chatId of chatIds) {
    let json;
    if (imgs.length >= 2) {
      // Album (compact grid) first — best-effort — then the text + buttons.
      await tgApi(token, 'sendMediaGroup', { chat_id: chatId, media: imgs.map((url) => ({ type: 'photo', media: url })) });
      json = await sendText(chatId);
    } else if (imgs.length === 1 && text.length <= 1024) {
      json = await tgApi(token, 'sendPhoto', {
        chat_id: chatId, photo: imgs[0], caption: text, parse_mode: 'HTML',
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      });
      if (!json?.ok) json = await sendText(chatId); // image unreachable → text fallback
    } else {
      json = await sendText(chatId);
    }
    if (json?.ok) anyOk = true;
    else lastError = json?.description || 'send failed';
  }
  if (!anyOk && lastError) console.error('[telegram] send failed:', lastError);
  return { ok: anyOk, error: anyOk ? null : lastError };
}

// Inline keyboard shown under the "payment submitted" alert so the owner can
// confirm/cancel from Telegram. callback_data is compact: "pay:<id>".
export function verifyKeyboard(orderId) {
  return {
    inline_keyboard: [[
      { text: '✅ Mark paid', callback_data: `pay:${orderId}` },
      { text: '✖ Cancel order', callback_data: `cancel:${orderId}` },
    ]],
  };
}

// Register/refresh the bot webhook so button taps reach us. `secret` is echoed
// back by Telegram in the X-Telegram-Bot-Api-Secret-Token header for verification.
export async function setTelegramWebhook(token, url, secret) {
  return tgApi(token, 'setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['callback_query'],
  });
}

export async function deleteTelegramWebhook(token) {
  return tgApi(token, 'deleteWebhook', {});
}

// Diagnostics: what does Telegram think our webhook is? Surfaces the last
// delivery error so button-tap failures are debuggable from the admin panel.
export async function getWebhookInfo(token) {
  return tgApi(token, 'getWebhookInfo', {});
}

const PAYMENT_LABEL = {
  none: 'Not set', razorpay: 'Online', cod: 'COD', whatsapp: 'WhatsApp', cash: 'Cash', upi: 'UPI', bank: 'Bank',
};
const PAY_STATUS = { paid: '🟢 Paid', submitted: '🟡 Awaiting verification', unpaid: '🔴 Unpaid' };

// Full postal address as a readable block, including landmark.
function addressBlock(addr = {}) {
  const l1 = [addr.line1, addr.line2].filter(Boolean).join(', ');
  const cityLine = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  return [l1, addr.landmark ? `Landmark: ${addr.landmark}` : '', cityLine]
    .filter(Boolean).map(esc).join('\n');
}

// Compose the "new order" message.
export function orderMessage(order) {
  const items = (order.items || [])
    .map((it) => `• ${esc(it.name)}  ×${it.qty}  —  ${fmt(it.price * it.qty)}`)
    .join('\n');
  const method = PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod;
  const status = PAY_STATUS[order.paymentStatus] || order.paymentStatus;
  const addr = addressBlock(order.address);

  return [
    `🛍️ <b>New Order</b>   <code>${esc(order.orderNo)}</code>`,
    `━━━━━━━━━━━━━━`,
    `🛒 <b>Items</b>`,
    items,
    `━━━━━━━━━━━━━━`,
    `💵 <b>Total:</b> ${fmt(order.total)}`,
    `💳 <b>Payment:</b> ${esc(method)} · ${status}`,
    order.couponCode ? `🏷️ <b>Coupon:</b> ${esc(order.couponCode)}` : '',
    `━━━━━━━━━━━━━━`,
    `👤 <b>${esc(order.customer?.name)}</b>`,
    `📞 ${esc(order.customer?.phone)}`,
    addr ? `📍 ${addr}` : '',
    order.notes ? `📝 ${esc(order.notes)}` : '',
  ].filter(Boolean).join('\n');
}

// Compose the "UPI payment submitted — verify" message.
export function paymentSubmittedMessage(order) {
  return [
    `💰 <b>Payment Submitted</b>   <code>${esc(order.orderNo)}</code>`,
    `━━━━━━━━━━━━━━`,
    `<b>${fmt(order.total)}</b> paid via UPI.`,
    `Verify against your bank, then tap ✅ Mark paid.`,
    order.upiRef ? `\n🔖 Ref: <code>${esc(order.upiRef)}</code>` : '',
    `\n👤 <b>${esc(order.customer?.name)}</b> · 📞 ${esc(order.customer?.phone)}`,
  ].filter(Boolean).join('\n');
}
