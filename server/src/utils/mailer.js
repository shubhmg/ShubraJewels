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

function formatAddress(addr = {}) {
  const parts = [
    [addr.line1, addr.line2].filter(Boolean).join(', '),
    addr.landmark ? `Near ${addr.landmark}` : '',
    [addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
  ].filter(Boolean);
  return parts.join('<br>') || '—';
}

// ---------------------------------------------------------------------------
// HTML email template — royal Rajasthani brand aesthetic
// ---------------------------------------------------------------------------

function buildOrderConfirmationHtml(order, settings = {}) {
  const storeName = settings.brandName || 'Shubra Jewels';
  const storeEmail = env.emailFrom || env.brevoSmtpUser;
  const gold = '#C9A84C';
  const maroon = '#7B1D1D';
  const cream = '#FDF6EC';
  const ink = '#1A0A0A';
  const lightGold = '#F5E9CA';

  // Items table rows
  const itemRows = (order.items || [])
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid ${lightGold};vertical-align:middle;">
          ${
            it.image
              ? `<img src="${it.image.startsWith('http') ? it.image : (env.publicUrl || '') + it.image}"
                      alt="${it.name}" width="52" height="52"
                      style="border-radius:6px;object-fit:cover;display:block;border:1.5px solid ${lightGold};" />`
              : `<div style="width:52px;height:52px;border-radius:6px;background:${lightGold};display:flex;align-items:center;justify-content:center;">
                   <span style="font-size:22px;">💍</span>
                 </div>`
          }
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid ${lightGold};vertical-align:middle;font-size:14px;color:${ink};">
          <span style="font-weight:600;">${it.name}</span>
          <br><span style="color:#888;font-size:12px;">Qty: ${it.qty}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid ${lightGold};vertical-align:middle;text-align:right;font-size:14px;font-weight:600;color:${maroon};">
          ${fmt(it.price * it.qty)}
        </td>
      </tr>`
    )
    .join('');

  // Totals section
  const totalsRows = [
    ['Subtotal', fmt(order.subtotal)],
    order.shipping > 0 ? ['Shipping', fmt(order.shipping)] : null,
    order.codFee > 0 ? ['COD Fee', fmt(order.codFee)] : null,
    order.discount > 0
      ? [`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, `− ${fmt(order.discount)}`]
      : null,
  ]
    .filter(Boolean)
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:5px 0;font-size:13px;color:#555;">${label}</td>
        <td style="padding:5px 0;font-size:13px;color:#555;text-align:right;">${value}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Order Confirmed — ${order.orderNo}</title>
</head>
<body style="margin:0;padding:0;background:#f0e8d8;font-family:'Georgia',serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0e8d8;padding:32px 16px;">
    <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="max-width:600px;width:100%;background:#fff;border-radius:16px;
                  overflow:hidden;box-shadow:0 8px 40px rgba(123,29,29,0.12);">

      <!-- ══ HEADER ══════════════════════════════════════════════════════ -->
      <tr>
        <td style="background:linear-gradient(135deg,${maroon} 0%,#9B2020 60%,#6B1515 100%);
                   padding:40px 32px 32px;text-align:center;">

          <!-- Decorative mandala ring -->
          <div style="width:72px;height:72px;border-radius:50%;background:rgba(201,168,76,0.18);
                      border:2px solid rgba(201,168,76,0.4);margin:0 auto 16px;
                      display:flex;align-items:center;justify-content:center;font-size:34px;
                      line-height:72px;">🪬</div>

          <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;letter-spacing:1px;">
            ${storeName}
          </h1>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7);
                    font-family:Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;">
            हर झुमका एक कहानी
          </p>

          <!-- Gold divider -->
          <div style="margin:20px auto 0;width:80px;height:2px;
                      background:linear-gradient(90deg,transparent,${gold},transparent);"></div>
        </td>
      </tr>

      <!-- ══ ORDER CONFIRMED BADGE ═══════════════════════════════════════ -->
      <tr>
        <td style="background:${lightGold};padding:20px 32px;text-align:center;">
          <span style="display:inline-block;background:${gold};color:#fff;font-size:11px;
                       font-family:Arial,sans-serif;font-weight:700;letter-spacing:2px;
                       text-transform:uppercase;border-radius:20px;padding:5px 18px;">
            ✓ &nbsp;Order Confirmed
          </span>
          <h2 style="margin:12px 0 4px;font-size:22px;color:${maroon};font-weight:700;">
            Thank you, ${order.customer?.name?.split(' ')[0] || 'dear customer'}! 🎉
          </h2>
          <p style="margin:0;font-size:14px;color:#666;font-family:Arial,sans-serif;">
            Your order <strong style="color:${maroon};">${order.orderNo}</strong> has been placed successfully.
          </p>
        </td>
      </tr>

      <!-- ══ ORDER ITEMS ═════════════════════════════════════════════════ -->
      <tr>
        <td style="padding:28px 32px 0;">
          <h3 style="margin:0 0 14px;font-size:15px;color:${maroon};
                     font-family:Arial,sans-serif;font-weight:700;letter-spacing:0.5px;">
            🛒 Your Items
          </h3>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border:1px solid ${lightGold};border-radius:10px;overflow:hidden;">
            ${itemRows}
          </table>
        </td>
      </tr>

      <!-- ══ ORDER TOTALS ════════════════════════════════════════════════ -->
      <tr>
        <td style="padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${totalsRows}
            <tr>
              <td colspan="2" style="padding-top:10px;border-top:1.5px solid ${lightGold};"></td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:16px;font-weight:700;color:${maroon};">
                Total
              </td>
              <td style="padding:6px 0;font-size:17px;font-weight:700;color:${maroon};text-align:right;">
                ${fmt(order.total)}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ══ DIVIDER ═════════════════════════════════════════════════════ -->
      <tr><td style="padding:0 32px;">
        <div style="height:1px;background:linear-gradient(90deg,transparent,${lightGold},transparent);"></div>
      </td></tr>

      <!-- ══ DELIVERY + PAYMENT ══════════════════════════════════════════ -->
      <tr>
        <td style="padding:24px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <!-- Delivery Address -->
              <td width="50%" style="vertical-align:top;padding-right:12px;">
                <h4 style="margin:0 0 8px;font-size:12px;font-family:Arial,sans-serif;
                           font-weight:700;color:${gold};letter-spacing:1.5px;text-transform:uppercase;">
                  📍 Deliver To
                </h4>
                <p style="margin:0;font-size:13px;color:${ink};font-family:Arial,sans-serif;
                          line-height:1.7;">
                  <strong>${order.customer?.name}</strong><br>
                  ${order.customer?.phone}<br>
                  ${formatAddress(order.address)}
                </p>
              </td>
              <!-- Payment -->
              <td width="50%" style="vertical-align:top;padding-left:12px;
                                     border-left:1px solid ${lightGold};">
                <h4 style="margin:0 0 8px;font-size:12px;font-family:Arial,sans-serif;
                           font-weight:700;color:${gold};letter-spacing:1.5px;text-transform:uppercase;">
                  💳 Payment
                </h4>
                <p style="margin:0;font-size:13px;color:${ink};font-family:Arial,sans-serif;
                          line-height:1.7;">
                  <strong style="text-transform:capitalize;">${
                    order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod || 'COD'
                  }</strong><br>
                  <span style="color:#777;">Pay when your jhumkas arrive 💛</span>
                  ${
                    order.couponCode
                      ? `<br><span style="color:${gold};font-weight:600;">🏷 Coupon: ${order.couponCode}</span>`
                      : ''
                  }
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      ${
        order.notes
          ? `<!-- ══ NOTES ═══════════════════════════════════════════════════════ -->
      <tr>
        <td style="padding:16px 32px 0;">
          <div style="background:${cream};border-left:3px solid ${gold};border-radius:4px;
                      padding:12px 16px;font-family:Arial,sans-serif;font-size:13px;color:#555;">
            <strong style="color:${maroon};">📝 Your Note:</strong> ${order.notes}
          </div>
        </td>
      </tr>`
          : ''
      }

      <!-- ══ WHAT NEXT ═══════════════════════════════════════════════════ -->
      <tr>
        <td style="padding:28px 32px;">
          <div style="background:${cream};border-radius:12px;padding:20px 24px;text-align:center;">
            <p style="margin:0 0 6px;font-size:14px;color:${maroon};font-weight:700;
                      font-family:Arial,sans-serif;">
              What happens next?
            </p>
            <p style="margin:0;font-size:13px;color:#666;font-family:Arial,sans-serif;line-height:1.8;">
              Our team will carefully pack your jhumkas and dispatch them soon.<br>
              You'll receive an update when your order ships. 🎁
            </p>
          </div>
        </td>
      </tr>

      <!-- ══ FOOTER ══════════════════════════════════════════════════════ -->
      <tr>
        <td style="background:linear-gradient(135deg,${maroon} 0%,#6B1515 100%);
                   padding:28px 32px;text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.9);
                    font-family:Arial,sans-serif;">
            Questions? Reach us on WhatsApp or email us at
            <a href="mailto:${storeEmail}"
               style="color:${gold};text-decoration:none;">${storeEmail}</a>
          </p>
          <div style="margin:14px auto;width:40px;height:1px;
                      background:rgba(201,168,76,0.4);"></div>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);
                    font-family:Arial,sans-serif;letter-spacing:1px;">
            © ${new Date().getFullYear()} ${storeName} &nbsp;·&nbsp; हर झुमका एक कहानी
          </p>
        </td>
      </tr>

    </table>
    </td></tr>
  </table>

</body>
</html>`;
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
      subject: `✨ Order Confirmed – ${order.orderNo} | ${storeName}`,
      html: buildOrderConfirmationHtml(order, settings),
    });
    console.log(`[mailer] confirmation sent to ${order.customer.email} for ${order.orderNo}`);
    return { ok: true };
  } catch (err) {
    console.error('[mailer] send failed:', err.message);
    return { ok: false, error: err.message };
  }
}
