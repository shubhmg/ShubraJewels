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

// Send an HTML message to every configured chat id. Returns { ok, error }.
export async function sendTelegram(settings, text) {
  const tg = settings?.notifications?.telegram || {};
  if (!tg.enabled || !tg.botToken || !tg.chatId) return { ok: false, error: 'not configured' };

  const chatIds = String(tg.chatId).split(',').map((s) => s.trim()).filter(Boolean);
  let lastError = null;
  let anyOk = false;

  for (const chatId of chatIds) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const json = await res.json().catch(() => null);
      if (json?.ok) anyOk = true;
      else lastError = json?.description || `HTTP ${res.status}`;
    } catch (e) {
      lastError = e.message || 'network error';
    }
  }
  if (!anyOk && lastError) console.error('[telegram] send failed:', lastError);
  return { ok: anyOk, error: anyOk ? null : lastError };
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
