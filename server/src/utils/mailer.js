// Email utility — Brevo SMTP via nodemailer.
// Config comes from env vars (BREVO_*). All sends are best-effort:
// errors are logged but never thrown so a bad config can't break order placement.

import nodemailer from 'nodemailer';
import env from '../config/env.js';

// ---------------------------------------------------------------------------
// Transport (lazy-initialised, module-level singleton)
// ---------------------------------------------------------------------------

let _transport = null;

function getTransport() {
  if (_transport) return _transport;
  if (!env.brevoSmtpHost || !env.brevoSmtpUser || !env.brevoSmtpPass) return null;
  _transport = nodemailer.createTransport({
    host: env.brevoSmtpHost,
    port: Number(env.brevoSmtpPort) || 587,
    secure: false, // STARTTLS on 587
    auth: { user: env.brevoSmtpUser, pass: env.brevoSmtpPass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return _transport;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Render an admin-typed shipment note as safe HTML: escape, keep line breaks,
// and make any pasted tracking link clickable.
function shipmentHtml(msg, linkColor) {
  const withBreaks = escapeHtml(msg).replace(/\n/g, '<br>');
  return withBreaks.replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${linkColor};font-weight:700;text-decoration:underline;">$1</a>`);
}

function formatAddress(addr = {}) {
  const parts = [
    [addr.line1, addr.line2].filter(Boolean).join(', '),
    addr.landmark ? `Near ${addr.landmark}` : '',
    [addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
  ].filter(Boolean);
  return parts.join('<br>') || '—';
}

// ---------------------------------------------------------------------------
// HTML email template — matches the ShubraJewels website exactly
// ---------------------------------------------------------------------------

function buildOrderEmailHtml(order, settings = {}, variant = 'confirmed') {
  const isShipped   = variant === 'shipped';
  const isCancelled = variant === 'cancelled';
  // Money already taken from the customer (to be refunded on cancellation).
  const refundAmt = isCancelled
    ? (order.paymentStatus === 'paid' ? Number(order.total || 0) : Number(order.advancePaid || 0))
    : 0;
  const storeName  = settings.brandName || 'Shubra Jewels';
  const storeEmail = env.emailFrom || env.brevoSmtpUser;
  const t          = settings.theme || {};

  // Pull live admin-controlled brand palette, fall back to defaults
  const maroon    = t.maroon    || '#7B1E2B';
  const maroonDk  = t.maroonDark|| '#5A121C';
  const gold      = t.gold      || '#C9A84C';
  const goldLight = t.goldLight || '#E3C97A';
  const beige     = t.beige     || '#F6ECD9';
  const cream     = t.cream     || '#FBF6EC';
  const ink       = t.ink       || '#2A1A16';
  // Derived pale-gold for borders/rows (lighten the gold slightly)
  const goldPale  = '#F5EDD5';

  const baseUrl = (() => {
    const u = (env.publicUrl || '').replace(/\/$/, '');
    if (!u) return '';
    return /^https?:\/\//.test(u) ? u : `https://${u}`;
  })();
  const absImg = (p) => !p ? '' : /^https?:\/\//.test(p) ? p : `${baseUrl}${p.startsWith('/') ? '' : '/'}${p}`;


  // ── Item rows ────────────────────────────────────────────────────────────
  const itemRows = (order.items || []).map((it) => {
    const imgSrc = it.image ? absImg(it.image) : '';
    const img = imgSrc
      ? `<img src="${imgSrc}" alt="${it.name}" width="56" height="56" style="width:56px;height:56px;border-radius:8px;object-fit:cover;display:block;border:1.5px solid ${goldPale};" />`
      : `<div style="width:56px;height:56px;border-radius:8px;background:${goldPale};display:table-cell;text-align:center;vertical-align:middle;font-size:24px;">💍</div>`;
    return `
    <tr>
      <td width="72" style="padding:12px 8px 12px 0;vertical-align:middle;">${img}</td>
      <td style="padding:12px 0;vertical-align:middle;border-bottom:1px solid ${goldPale};">
        <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:${ink};font-family:'Plus Jakarta Sans',Arial,sans-serif;">${it.name}</p>
        <p style="margin:0;font-size:12px;color:#9a8a7a;font-family:Arial,sans-serif;">Qty: ${it.qty}</p>
      </td>
      <td style="padding:12px 0 12px 12px;vertical-align:middle;border-bottom:1px solid ${goldPale};text-align:right;white-space:nowrap;">
        <p style="margin:0;font-size:14px;font-weight:700;color:${maroon};font-family:'Plus Jakarta Sans',Arial,sans-serif;">${fmt(it.price * it.qty)}</p>
        ${it.qty > 1 ? `<p style="margin:2px 0 0;font-size:11px;color:#b0a090;font-family:Arial,sans-serif;">${fmt(it.price)} each</p>` : ''}
      </td>
    </tr>`;
  }).join('');

  // ── Totals rows ──────────────────────────────────────────────────────────
  const totalsRows = [
    order.shipping > 0   ? ['Shipping',   fmt(order.shipping)]   : null,
    order.codFee  > 0   ? ['COD Fee',     fmt(order.codFee)]     : null,
    order.discount > 0  ? [`Discount${order.couponCode ? ` · ${order.couponCode}` : ''}`, `−&nbsp;${fmt(order.discount)}`] : null,
  ].filter(Boolean).map(([l, v]) => `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#7a6a5a;font-family:Arial,sans-serif;">${l}</td>
      <td style="padding:4px 0;font-size:13px;color:#7a6a5a;font-family:Arial,sans-serif;text-align:right;">${v}</td>
    </tr>`).join('');

  const payLabel = { cod: 'Cash on Delivery', razorpay: 'Online Payment', upi: 'UPI', cash: 'Cash', bank: 'Bank Transfer', whatsapp: 'WhatsApp' };

  const firstName = order.customer?.name?.split(' ')[0] || 'dear customer';
  const shipMsg = (order.tracking?.message || '').trim();
  const shipBody = shipMsg
    ? shipmentHtml(shipMsg, maroon)
    : 'Your order has been carefully packed and is on its way to you. 📦';

  const titleText = isCancelled
    ? `Your order has been cancelled — ${order.orderNo}`
    : isShipped ? `Your order is on its way — ${order.orderNo}` : `Order Confirmed — ${order.orderNo}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${titleText}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Mukta:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Mukta:wght@400;600;700&display=swap');
    body { margin:0; padding:0; background:${beige}; font-family:'Plus Jakarta Sans',Arial,sans-serif; }
    .hindi { font-family:'Mukta',Arial,sans-serif; }
    a { color:inherit; }
    @media (max-width:600px) {
      .container { width:100% !important; }
      .inner-pad { padding:20px 16px !important; }
      .two-col td { display:block !important; width:100% !important; padding-right:0 !important; padding-left:0 !important; border-left:none !important; padding-top:16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${beige};">

<table width="100%" cellpadding="0" cellspacing="0" style="background:${beige};padding:32px 16px;">
<tr><td align="center">
<table class="container" width="600" cellpadding="0" cellspacing="0"
       style="max-width:600px;width:100%;background:#fff;border-radius:20px;overflow:hidden;
              box-shadow:0 4px 40px rgba(90,18,28,0.13);">

  <!-- ══ HEADER ══ -->
  <tr>
    <td style="background:linear-gradient(150deg,${maroon} 0%,${maroonDk} 100%);padding:36px 32px 28px;text-align:center;">
      <!-- decorative gold rule above brand name -->
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px;width:72px;">
        <tr><td style="height:2px;background:linear-gradient(90deg,transparent,${gold},transparent);"></td></tr>
      </table>
      <!-- Brand name in Plus Jakarta Sans -->
      <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;letter-spacing:0.5px;
                 font-family:'Plus Jakarta Sans',Arial,sans-serif;">${storeName}</h1>
      <!-- Hindi slogan in Mukta -->
      <p class="hindi" style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.7);
                 font-family:'Mukta',Arial,sans-serif;letter-spacing:1px;">
        हर झुमका एक कहानी
      </p>
      <!-- gold rule -->
      <table cellpadding="0" cellspacing="0" style="margin:18px auto 0;width:72px;">
        <tr><td style="height:2px;background:linear-gradient(90deg,transparent,${gold},transparent);"></td></tr>
      </table>
    </td>
  </tr>

  <!-- ══ STATUS BANNER ══ -->
  <tr>
    <td style="background:${goldPale};padding:24px 32px 20px;text-align:center;">
      <span style="display:inline-block;background:${isCancelled || isShipped ? maroon : gold};color:#fff;font-size:11px;font-weight:700;
                   letter-spacing:2px;text-transform:uppercase;border-radius:30px;padding:5px 20px;
                   font-family:'Plus Jakarta Sans',Arial,sans-serif;">${isCancelled ? '✖ &nbsp;Order Cancelled' : isShipped ? '📦 &nbsp;Shipped' : '✓ &nbsp;Order Confirmed'}</span>
      <h2 style="margin:14px 0 6px;font-size:22px;font-weight:800;color:${maroon};
                 font-family:'Plus Jakarta Sans',Arial,sans-serif;">
        ${isCancelled ? `We're sorry, ${firstName} 🙏` : isShipped ? `It's on its way, ${firstName}! 🚚` : `Thank you, ${firstName}! ✨`}
      </h2>
      <p style="margin:0;font-size:14px;color:#8a7060;font-family:Arial,sans-serif;line-height:1.6;">
        ${isCancelled
          ? `Your order <strong style="color:${maroon};font-family:'Plus Jakarta Sans',Arial,sans-serif;">${order.orderNo}</strong> has been cancelled.`
          : isShipped
          ? `Great news — your order <strong style="color:${maroon};font-family:'Plus Jakarta Sans',Arial,sans-serif;">${order.orderNo}</strong> has shipped.`
          : `Your order <strong style="color:${maroon};font-family:'Plus Jakarta Sans',Arial,sans-serif;">${order.orderNo}</strong> has been placed and we're getting it ready.`}
      </p>
    </td>
  </tr>

  ${isCancelled ? `
  <!-- ══ CANCELLATION DETAILS (primary focus) ══ -->
  <tr>
    <td class="inner-pad" style="padding:26px 32px 4px;">
      <div style="background:${cream};border:1.5px solid ${gold};border-radius:16px;padding:22px 24px;">
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
                  color:${gold};font-family:'Plus Jakarta Sans',Arial,sans-serif;">Why was it cancelled?</p>
        <p style="margin:0;font-size:15px;color:${ink};line-height:1.75;font-family:Arial,sans-serif;">
          ${escapeHtml((order.cancelReason || '').trim()) || 'We were unable to fulfil this order.'}
        </p>
        ${refundAmt > 0 ? `
        <div style="height:1px;background:linear-gradient(90deg,transparent,${goldPale},transparent);margin:16px 0;"></div>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
                  color:${gold};font-family:'Plus Jakarta Sans',Arial,sans-serif;">💸 &nbsp;Your Refund</p>
        <p style="margin:0;font-size:15px;color:${ink};line-height:1.75;font-family:Arial,sans-serif;">
          The <strong style="color:${maroon};font-family:'Plus Jakarta Sans',Arial,sans-serif;">${fmt(refundAmt)}</strong> you paid
          ${order.paymentStatus === 'paid' ? '' : 'as advance '}will be refunded to your original payment method within
          <strong>5–7 business days</strong>. No action is needed from your side.
        </p>` : ''}
      </div>
    </td>
  </tr>` : ''}

  ${isShipped ? `
  <!-- ══ SHIPMENT UPDATE (primary focus) ══ -->
  <tr>
    <td class="inner-pad" style="padding:26px 32px 4px;">
      <div style="background:${cream};border:1.5px solid ${gold};border-radius:16px;padding:22px 24px;">
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
                  color:${gold};font-family:'Plus Jakarta Sans',Arial,sans-serif;">🚚 &nbsp;Shipment Update</p>
        <p style="margin:0;font-size:15px;color:${ink};line-height:1.75;font-family:Arial,sans-serif;">
          ${shipBody}
        </p>
      </div>
    </td>
  </tr>` : ''}

  <!-- ══ ITEMS ══ -->
  <tr>
    <td class="inner-pad" style="padding:28px 32px 0;">
      <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
                color:${gold};font-family:'Plus Jakarta Sans',Arial,sans-serif;">Your Items</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${itemRows}
      </table>
    </td>
  </tr>

  <!-- ══ TOTALS ══ -->
  <tr>
    <td class="inner-pad" style="padding:16px 32px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#9a8a7a;font-family:Arial,sans-serif;">Subtotal</td>
          <td style="padding:6px 0;font-size:13px;color:#9a8a7a;font-family:Arial,sans-serif;text-align:right;">${fmt(order.subtotal)}</td>
        </tr>
        ${totalsRows}
        <tr><td colspan="2" style="padding:0;"><div style="height:1px;background:linear-gradient(90deg,transparent,${goldPale},transparent);margin:8px 0;"></div></td></tr>
        <tr>
          <td style="padding:6px 0;font-size:17px;font-weight:800;color:${maroon};
                     font-family:'Plus Jakarta Sans',Arial,sans-serif;">Total</td>
          <td style="padding:6px 0;font-size:18px;font-weight:800;color:${maroon};text-align:right;
                     font-family:'Plus Jakarta Sans',Arial,sans-serif;">${fmt(order.total)}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ══ GOLD DIVIDER ══ -->
  <tr><td style="padding:0 32px;">
    <div style="height:1px;background:linear-gradient(90deg,transparent,${goldPale},transparent);"></div>
  </td></tr>

  <!-- ══ DELIVERY + PAYMENT ══ -->
  <tr>
    <td class="inner-pad" style="padding:24px 32px 0;">
      <table class="two-col" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" style="vertical-align:top;padding-right:20px;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
                      color:${gold};font-family:'Plus Jakarta Sans',Arial,sans-serif;">Deliver To</p>
            <p style="margin:0;font-size:13px;color:${ink};line-height:1.8;font-family:Arial,sans-serif;">
              <strong style="font-family:'Plus Jakarta Sans',Arial,sans-serif;">${order.customer?.name}</strong><br>
              ${order.customer?.phone}<br>
              ${formatAddress(order.address)}
            </p>
          </td>
          <td width="50%" style="vertical-align:top;padding-left:20px;border-left:1px solid ${goldPale};">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
                      color:${gold};font-family:'Plus Jakarta Sans',Arial,sans-serif;">Payment</p>
            <p style="margin:0;font-size:13px;color:${ink};line-height:1.8;font-family:Arial,sans-serif;">
              <strong style="font-family:'Plus Jakarta Sans',Arial,sans-serif;">${payLabel[order.paymentMethod] || 'Cash on Delivery'}</strong><br>
              <span style="color:#9a8a7a;">${order.paymentStatus === 'paid' ? 'Paid online' : isCancelled ? 'Nothing to collect' : 'Amount collected on delivery'}</span>
              ${order.couponCode ? `<br><span style="color:${gold};font-weight:600;font-family:'Plus Jakarta Sans',Arial,sans-serif;">🏷 ${order.couponCode} applied</span>` : ''}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  ${order.notes ? `
  <!-- ══ NOTES ══ -->
  <tr>
    <td class="inner-pad" style="padding:20px 32px 0;">
      <div style="background:${cream};border-left:3px solid ${gold};border-radius:0 8px 8px 0;padding:12px 16px;">
        <p style="margin:0;font-size:13px;color:${ink};font-family:Arial,sans-serif;">
          <strong style="color:${maroon};font-family:'Plus Jakarta Sans',Arial,sans-serif;">Your Note:</strong> ${order.notes}
        </p>
      </div>
    </td>
  </tr>` : ''}

  <!-- ══ WHAT'S NEXT ══ -->
  <tr>
    <td class="inner-pad" style="padding:28px 32px;">
      <div style="background:${cream};border-radius:14px;padding:22px 24px;text-align:center;
                  border:1px solid ${goldPale};">
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:${maroon};
                  font-family:'Plus Jakarta Sans',Arial,sans-serif;">${isCancelled ? 'We hope to see you again' : isShipped ? 'Almost there!' : 'What happens next?'}</p>
        <p style="margin:0;font-size:13px;color:#8a7060;font-family:Arial,sans-serif;line-height:1.8;">
          ${isCancelled
            ? `${refundAmt > 0 ? 'Your refund is on its way.' : 'No payment was taken for this order.'}<br>Have a question? Just reply to this email — we're happy to help. 💛`
            : isShipped
            ? `Your jhumkas are en route to you.<br>Have a question? Just reply to this email. 💛`
            : `Our artisans will carefully pack your jhumkas with love.<br>You'll receive a shipping update soon. 📦`}
        </p>
      </div>
    </td>
  </tr>

  <!-- ══ FOOTER ══ -->
  <tr>
    <td style="background:linear-gradient(150deg,${maroon} 0%,${maroonDk} 100%);padding:28px 32px;text-align:center;">
      <!-- mehendi-style gold rule -->
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px;width:120px;">
        <tr>
          <td style="height:1px;background:rgba(201,168,76,0.3);"></td>
          <td width="8" style="text-align:center;color:${gold};font-size:10px;padding:0 6px;">✦</td>
          <td style="height:1px;background:rgba(201,168,76,0.3);"></td>
        </tr>
      </table>
      <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.8);font-family:Arial,sans-serif;">
        Questions? We're here for you —
        <a href="mailto:${storeEmail}" style="color:${goldLight};text-decoration:none;font-family:'Plus Jakarta Sans',Arial,sans-serif;">${storeEmail}</a>
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:14px auto;width:40px;">
        <tr><td style="height:1px;background:rgba(201,168,76,0.3);"></td></tr>
      </table>
      <p class="hindi" style="margin:0;font-size:13px;color:rgba(255,255,255,0.55);
                font-family:'Mukta',Arial,sans-serif;letter-spacing:1px;">
        हर झुमका एक कहानी &nbsp;·&nbsp; © ${new Date().getFullYear()} ${storeName}
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>

`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an order-confirmation email to the customer.
 * Best-effort — never throws. Returns { ok, error }.
 */
export async function sendOrderConfirmation(order, settings = {}) {
  console.log('[mailer] called for', order?.orderNo, '| email:', order?.customer?.email);
  if (!order.customer?.email) return { ok: false, error: 'no customer email' };

  const transport = getTransport();
  console.log('[mailer] transport:', transport ? 'ok' : 'null — SMTP not configured');
  if (!transport) return { ok: false, error: 'SMTP not configured' };

  const storeName = settings.brandName || 'Shubra Jewels';
  const fromName = env.emailFromName || storeName;
  const fromAddr = env.emailFrom || env.brevoSmtpUser;

  try {
    await transport.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: order.customer.email,
      subject: `✨ Order Confirmed | ${storeName}`,
      html: buildOrderEmailHtml(order, settings, 'confirmed'),
    });
    console.log(`[mailer] confirmation sent to ${order.customer.email} for ${order.orderNo}`);
    return { ok: true };
  } catch (err) {
    console.error('[mailer] send failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send an order-shipped email to the customer. Same layout as the confirmation,
 * with the shipment/tracking message as the primary focus.
 * Best-effort — never throws. Returns { ok, error }.
 */
export async function sendOrderShipped(order, settings = {}) {
  console.log('[mailer] shipped email for', order?.orderNo, '| email:', order?.customer?.email);
  if (!order.customer?.email) return { ok: false, error: 'no customer email' };

  const transport = getTransport();
  if (!transport) return { ok: false, error: 'SMTP not configured' };

  const storeName = settings.brandName || 'Shubra Jewels';
  const fromName = env.emailFromName || storeName;
  const fromAddr = env.emailFrom || env.brevoSmtpUser;

  try {
    await transport.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: order.customer.email,
      subject: `📦 Your order has shipped | ${storeName}`,
      html: buildOrderEmailHtml(order, settings, 'shipped'),
    });
    console.log(`[mailer] shipped email sent to ${order.customer.email} for ${order.orderNo}`);
    return { ok: true };
  } catch (err) {
    console.error('[mailer] shipped send failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send an order-cancelled email to the customer. Same layout, with the
 * cancellation reason (order.cancelReason) as the primary focus and a refund
 * note when the customer had paid anything (online full or COD advance).
 * Best-effort — never throws. Returns { ok, error }.
 */
export async function sendOrderCancelled(order, settings = {}) {
  console.log('[mailer] cancelled email for', order?.orderNo, '| email:', order?.customer?.email);
  if (!order.customer?.email) return { ok: false, error: 'no customer email' };

  const transport = getTransport();
  if (!transport) return { ok: false, error: 'SMTP not configured' };

  const storeName = settings.brandName || 'Shubra Jewels';
  const fromName = env.emailFromName || storeName;
  const fromAddr = env.emailFrom || env.brevoSmtpUser;

  try {
    await transport.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: order.customer.email,
      subject: `Your order ${order.orderNo} has been cancelled | ${storeName}`,
      html: buildOrderEmailHtml(order, settings, 'cancelled'),
    });
    console.log(`[mailer] cancelled email sent to ${order.customer.email} for ${order.orderNo}`);
    return { ok: true };
  } catch (err) {
    console.error('[mailer] cancelled send failed:', err.message);
    return { ok: false, error: err.message };
  }
}
