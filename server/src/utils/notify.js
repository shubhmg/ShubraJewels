// Telegram order notifications. Config lives in the Settings doc
// (notifications.telegram) so the store owner manages it from the admin panel.
// All sends are best-effort: failures are logged, never thrown, so a bad token
// can't break order placement.

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

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
// keyboard (replyMarkup). Returns { ok, error }.
export async function sendTelegram(settings, text, { replyMarkup } = {}) {
  const tg = settings?.notifications?.telegram || {};
  if (!tg.enabled || !tg.botToken || !tg.chatId) return { ok: false, error: 'not configured' };

  const chatIds = String(tg.chatId).split(',').map((s) => s.trim()).filter(Boolean);
  let lastError = null;
  let anyOk = false;

  for (const chatId of chatIds) {
    const json = await tgApi(tg.botToken, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
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

const PAYMENT_LABEL = {
  none: 'Not set', razorpay: 'Online', cod: 'COD', whatsapp: 'WhatsApp', cash: 'Cash', upi: 'UPI', bank: 'Bank',
};

// Compose the "new order" message.
export function orderMessage(order) {
  const items = (order.items || [])
    .map((it) => `• ${esc(it.name)} × ${it.qty}`)
    .join('\n');
  const addr = order.address || {};
  const place = [addr.city, addr.pincode].filter(Boolean).join(' · ');
  const pay = `${PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod} (${order.paymentStatus})`;
  return [
    `🛍️ <b>New order ${esc(order.orderNo)}</b>`,
    `${fmt(order.total)} · ${esc(pay)}`,
    `👤 ${esc(order.customer?.name)} · ${esc(order.customer?.phone)}`,
    place ? `📍 ${esc(place)}` : '',
    '',
    items,
  ].filter(Boolean).join('\n');
}

// Compose the "UPI payment submitted — verify" message.
export function paymentSubmittedMessage(order) {
  return [
    `💰 <b>Payment submitted · ${esc(order.orderNo)}</b>`,
    `${fmt(order.total)} via UPI — verify against your bank, then mark paid.`,
    order.upiRef ? `Ref: <code>${esc(order.upiRef)}</code>` : '',
    `👤 ${esc(order.customer?.name)} · ${esc(order.customer?.phone)}`,
  ].filter(Boolean).join('\n');
}
