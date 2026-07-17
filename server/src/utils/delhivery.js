// Delhivery integration. Config lives in the Settings doc (`delhivery`) so the
// store owner manages the API token, pickup warehouse, and automation policy
// from the admin panel — no code change to go live.
//
// The API token is a SECRET: it is stripped from the public GET /settings and
// only ever read server-side here. Never send `settings.delhivery.token` to the
// storefront.
//
// Reads are best-effort (return { ok:false, error } instead of throwing) so a
// bad token can never break order placement or the orders list. Shipment
// CREATION surfaces its error to the admin (they need to know it failed).

const PROD_BASE = 'https://track.delhivery.com';
const STAGING_BASE = 'https://staging-express.delhivery.com';

// Which orders should be routed through Delhivery, given the admin's policy.
//   all      — every order
//   cod      — only Cash-on-Delivery orders (prepaid shipped manually)
//   prepaid  — only prepaid/online-paid orders (COD shipped manually)
//   manual   — never automatic; the admin pushes each order by hand
export function delhiveryConfig(settings) {
  const d = settings?.delhivery?.toObject?.() ?? settings?.delhivery ?? {};
  return {
    enabled: !!d.enabled,
    token: d.token || '',
    base: d.staging ? STAGING_BASE : PROD_BASE,
    pickupName: d.pickupName || '',
    pickup: {
      name: d.pickupName || '',
      phone: d.pickupPhone || '',
      address: d.pickupAddress || '',
      city: d.pickupCity || '',
      state: d.pickupState || '',
      pin: d.pickupPin || '',
    },
    policy: d.policy || 'manual',
    defaultWeightGrams: Number(d.defaultWeightGrams) || 100,
    sellerName: d.sellerName || settings?.brandName || 'Shubra Jewels',
    productDesc: d.productDesc || 'Imitation jewellery (jhumka)',
    staging: !!d.staging,
  };
}

// Is Delhivery configured enough to create shipments?
export function delhiveryReady(cfg) {
  return cfg.enabled && !!cfg.token && !!cfg.pickupName;
}

// Prepaid vs COD from the order's payment method/status.
export function orderPaymentMode(order) {
  // Fully paid (online/UPI/advance covering all) → Prepaid; else COD.
  const paid = order.paymentStatus === 'paid';
  const isCod = ['cod', 'cash'].includes(order.paymentMethod);
  return paid || !isCod ? 'Prepaid' : 'COD';
}

// Does the policy say THIS order should auto-ship via Delhivery?
export function shouldAutoShip(cfg, order) {
  if (!delhiveryReady(cfg)) return false;
  const mode = orderPaymentMode(order);
  switch (cfg.policy) {
    case 'all': return true;
    case 'cod': return mode === 'COD';
    case 'prepaid': return mode === 'Prepaid';
    default: return false; // 'manual'
  }
}

// COD amount to collect on delivery = order total minus any advance already paid.
function codAmount(order) {
  const mode = orderPaymentMode(order);
  if (mode !== 'COD') return 0;
  return Math.max(0, Number(order.total || 0) - Number(order.advancePaid || 0));
}

// Order weight in grams: per-order override, else defaultWeightGrams × total qty.
export function estimateWeight(cfg, order, override) {
  if (override && Number(override) > 0) return Math.round(Number(override));
  const qty = (order.items || []).reduce((a, i) => a + (i.qty || 0), 0) || 1;
  return Math.max(1, Math.round(cfg.defaultWeightGrams * qty));
}

async function dApi(cfg, method, path, { json, form, timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const headers = {
      Authorization: `Token ${cfg.token}`,
      Accept: 'application/json',
    };
    let body;
    if (form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    } else if (json) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    }
    const res = await fetch(`${cfg.base}${path}`, { method, headers, body, signal: ctrl.signal });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    return { httpOk: res.ok, status: res.status, data };
  } catch (e) {
    return { httpOk: false, status: 0, data: null, error: e.message || 'network error' };
  } finally {
    clearTimeout(t);
  }
}

// Pincode serviceability. Returns { ok, serviceable, cod, prepaid, city, state, error }.
export async function checkServiceability(settings, pin) {
  const cfg = delhiveryConfig(settings);
  if (!cfg.enabled || !cfg.token) return { ok: false, error: 'Delhivery not configured' };
  if (!/^\d{6}$/.test(String(pin || '').trim())) return { ok: false, error: 'Enter a valid 6-digit PIN' };

  const r = await dApi(cfg, 'GET', `/c/api/pin-codes/json/?filter_codes=${pin}`, { timeout: 9000 });
  if (r.error) return { ok: false, error: r.error };
  const codes = r.data?.delivery_codes || [];
  if (!codes.length) return { ok: true, serviceable: false, cod: false, prepaid: false };
  const pc = codes[0]?.postal_code || {};
  return {
    ok: true,
    serviceable: true,
    cod: pc.cod === 'Y',
    prepaid: pc.pre_paid === 'Y',
    city: pc.district || pc.city || '',
    state: pc.state_code || '',
  };
}

// Estimate the Surface freight for a parcel (Delhivery is a single carrier, so
// there's one rate — unlike Shiprocket's courier list). Uses the Invoice
// Charges API. Returns { ok, amount, error }. `grams` = chargeable weight.
export async function estimateRate(settings, { pin, grams, cod } = {}) {
  const cfg = delhiveryConfig(settings);
  if (!cfg.enabled || !cfg.token) return { ok: false, error: 'Delhivery not configured' };
  const origin = cfg.pickup.pin;
  if (!origin) return { ok: false, error: 'Set the Delhivery pickup PIN to estimate rates' };
  if (!/^\d{6}$/.test(String(pin || '').trim())) return { ok: false, error: 'Enter a valid 6-digit PIN' };

  const qs = new URLSearchParams({
    md: 'S',              // Surface (matches createShipment's shipping_mode)
    ss: 'Delivered',      // forward shipment
    o_pin: String(origin),
    d_pin: String(pin).trim(),
    cgm: String(Math.max(1, Math.round(Number(grams) || 100))),
    pt: cod ? 'COD' : 'Pre-paid',
  }).toString();
  const r = await dApi(cfg, 'GET', `/api/kinko/v1/invoice/charges/.json?${qs}`, { timeout: 9000 });
  if (r.error) return { ok: false, error: r.error };
  const row = Array.isArray(r.data) ? r.data[0] : r.data;
  const amount = Number(row?.total_amount ?? row?.gross_amount);
  if (!row || !isFinite(amount)) return { ok: false, error: 'No rate returned', raw: r.data };
  return { ok: true, amount: Math.round(amount) };
}

// Create a forward shipment (CMU). Returns { ok, waybill, mode, error, raw }.
// `orderRef` overrides the courier-side order id on re-books (must be unique).
export async function createShipment(settings, order, { weight, orderRef } = {}) {
  const cfg = delhiveryConfig(settings);
  if (!delhiveryReady(cfg)) return { ok: false, error: 'Delhivery is not fully configured (token + pickup warehouse required).' };

  const addr = order.address || {};
  const mode = orderPaymentMode(order);
  const cod = codAmount(order);
  const grams = estimateWeight(cfg, order, weight);
  const fullAddress = [addr.line1, addr.line2, addr.landmark && `Near ${addr.landmark}`].filter(Boolean).join(', ');

  const shipment = {
    name: order.customer?.name || '',
    add: fullAddress || addr.city || '',
    pin: String(addr.pincode || '').trim(),
    city: addr.city || '',
    state: addr.state || '',
    country: 'India',
    phone: String(order.customer?.phone || '').replace(/\D/g, '').slice(-10),
    order: orderRef || order.orderNo,
    order_date: (order.createdAt ? new Date(order.createdAt) : new Date()).toISOString(),
    payment_mode: mode, // 'COD' | 'Prepaid'
    cod_amount: String(cod),
    total_amount: String(order.total || 0),
    products_desc: cfg.productDesc,
    quantity: String((order.items || []).reduce((a, i) => a + (i.qty || 0), 0) || 1),
    weight: String(grams),
    seller_name: cfg.sellerName,
    seller_add: cfg.pickup.address,
    shipping_mode: 'Surface',
    waybill: '', // let Delhivery assign
  };

  const payload = { shipments: [shipment], pickup_location: { name: cfg.pickupName } };
  const r = await dApi(cfg, 'POST', '/api/cmu/create.json', {
    form: { format: 'json', data: JSON.stringify(payload) },
  });
  if (r.error) return { ok: false, error: r.error };

  const data = r.data || {};
  const pkg = (data.packages || [])[0] || {};
  const success = pkg.status === 'Success' && pkg.waybill;
  if (!success) {
    const remarks = Array.isArray(pkg.remarks) ? pkg.remarks.join('; ') : (pkg.remarks || '');
    const err = remarks || data.rmk || data.error || (r.httpOk ? 'Delhivery rejected the shipment' : `HTTP ${r.status}`);
    return { ok: false, error: err, raw: data };
  }
  return { ok: true, waybill: String(pkg.waybill), mode, codAmount: cod, weight: grams, raw: pkg };
}

// Track a waybill. Returns { ok, status, statusType, statusDate, location, error }.
export async function trackShipment(settings, waybill) {
  const cfg = delhiveryConfig(settings);
  if (!cfg.enabled || !cfg.token) return { ok: false, error: 'Delhivery not configured' };
  const r = await dApi(cfg, 'GET', `/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}`, { timeout: 9000 });
  if (r.error) return { ok: false, error: r.error };
  const sd = (r.data?.ShipmentData || [])[0]?.Shipment || null;
  if (!sd) return { ok: false, error: 'No tracking data yet' };
  const st = sd.Status || {};
  return {
    ok: true,
    status: st.Status || '',
    statusType: st.StatusType || '',
    statusDate: st.StatusDateTime || '',
    location: st.StatusLocation || '',
    delivered: (st.Status || '').toLowerCase() === 'delivered',
  };
}

// Cancel a waybill. Returns { ok, error }.
export async function cancelShipment(settings, waybill) {
  const cfg = delhiveryConfig(settings);
  if (!cfg.enabled || !cfg.token) return { ok: false, error: 'Delhivery not configured' };
  const r = await dApi(cfg, 'POST', '/api/p/edit', { json: { waybill: String(waybill), cancellation: 'true' } });
  if (r.error) return { ok: false, error: r.error };
  const ok = r.data?.status === true || r.data?.status === 'Success' || /cancel/i.test(JSON.stringify(r.data || {}));
  if (!ok) return { ok: false, error: r.data?.remark || r.data?.error || 'Could not cancel', raw: r.data };
  return { ok: true, raw: r.data };
}

// Packing-slip / shipping-label PDF link for a waybill. Returns { ok, url, error }.
export async function labelLink(settings, waybill) {
  const cfg = delhiveryConfig(settings);
  if (!cfg.enabled || !cfg.token) return { ok: false, error: 'Delhivery not configured' };
  const r = await dApi(cfg, 'GET', `/api/p/packing_slip?wbns=${encodeURIComponent(waybill)}&pdf=true`, { timeout: 12000 });
  if (r.error) return { ok: false, error: r.error };
  const pkg = (r.data?.packages || [])[0] || {};
  const url = pkg.pdf_download_link || r.data?.pdf_download_link || '';
  if (!url) return { ok: false, error: 'Label not ready yet', raw: r.data };
  return { ok: true, url };
}

// Public tracking URL a customer can open.
export function trackingUrl(waybill) {
  return `https://www.delhivery.com/track/package/${encodeURIComponent(waybill)}`;
}
