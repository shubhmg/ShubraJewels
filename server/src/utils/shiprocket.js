// Shiprocket integration. Config lives in the Settings doc (`shiprocket`).
// Shiprocket authenticates with the account email + password (both SECRET —
// stripped from the public GET /settings) to mint a JWT that is valid ~10 days;
// we cache it on the settings doc (`shiprocket.token` + `tokenExpiry`) and
// refresh transparently when it expires.
//
// Booking a parcel is a 3-step dance: create an ad-hoc order → assign an AWB
// (Shiprocket picks the recommended courier) → fetch the label. Reads are
// best-effort; booking surfaces its error to the admin.

const BASE = 'https://apiv2.shiprocket.in/v1/external';

export function shiprocketConfig(settings) {
  const s = settings?.shiprocket?.toObject?.() ?? settings?.shiprocket ?? {};
  return {
    enabled: !!s.enabled,
    email: s.email || '',
    password: s.password || '',
    policy: s.policy || 'manual',
    pickupLocation: s.pickupLocation || '',
    pickupPin: s.pickupPin || '',
    autoPickup: !!s.autoPickup, // call generate/pickup after booking (summons courier)
    defaultWeightKg: Number(s.defaultWeightKg) || 0.3,
    dims: {
      length: Number(s.length) || 12,
      breadth: Number(s.breadth) || 10,
      height: Number(s.height) || 5,
    },
  };
}

export function shiprocketReady(cfg) {
  return cfg.enabled && !!cfg.email && !!cfg.password && !!cfg.pickupLocation;
}

// Prepaid vs COD (mirrors delhivery.js::orderPaymentMode).
export function orderPaymentMode(order) {
  const paid = order.paymentStatus === 'paid';
  const isCod = ['cod', 'cash', 'none'].includes(order.paymentMethod);
  return paid || !isCod ? 'Prepaid' : 'COD';
}

export function shouldAutoShip(cfg, order) {
  if (!shiprocketReady(cfg)) return false;
  const mode = orderPaymentMode(order);
  switch (cfg.policy) {
    case 'all': return true;
    case 'cod': return mode === 'COD';
    case 'prepaid': return mode === 'Prepaid';
    default: return false;
  }
}

export function estimateWeightKg(cfg, order, override) {
  if (override && Number(override) > 0) return Number(override);
  const qty = (order.items || []).reduce((a, i) => a + (i.qty || 0), 0) || 1;
  return Math.max(0.1, Number((cfg.defaultWeightKg * qty).toFixed(3)));
}

async function srFetch(token, method, path, body, timeout = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal,
    });
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

// Return a valid Shiprocket JWT, refreshing (and persisting) it if expired.
// `settingDoc` is the live Mongoose Setting document so we can cache the token.
export async function ensureToken(settingDoc) {
  const cfg = shiprocketConfig(settingDoc);
  if (!cfg.email || !cfg.password) return { ok: false, error: 'Shiprocket email/password not set' };

  const sr = settingDoc.shiprocket || {};
  const now = Date.now();
  const exp = sr.tokenExpiry ? new Date(sr.tokenExpiry).getTime() : 0;
  if (sr.token && exp > now + 60 * 60 * 1000) return { ok: true, token: sr.token }; // >1h left

  const r = await srFetch(null, 'POST', '/auth/login', { email: cfg.email, password: cfg.password });
  const token = r.data?.token;
  if (!token) {
    return { ok: false, error: r.data?.message || (r.httpOk ? 'Login failed' : `HTTP ${r.status}`) };
  }
  settingDoc.shiprocket.token = token;
  settingDoc.shiprocket.tokenExpiry = new Date(now + 9 * 24 * 60 * 60 * 1000); // ~9 days
  settingDoc.markModified('shiprocket');
  try { await settingDoc.save(); } catch { /* cache best-effort */ }
  return { ok: true, token };
}

// COD collectible = total − advance (COD only).
function codAmount(order) {
  if (orderPaymentMode(order) !== 'COD') return 0;
  return Math.max(0, Number(order.total || 0) - Number(order.advancePaid || 0));
}

// Serviceability between the account's pickup PIN and a delivery PIN.
// Returns { ok, serviceable, couriers: [{ name, rate, cod, etd }], cheapest }.
export async function checkServiceability(settingDoc, { pickupPin, deliveryPin, weightKg, cod }) {
  const auth = await ensureToken(settingDoc);
  if (!auth.ok) return { ok: false, error: auth.error };
  const qs = new URLSearchParams({
    pickup_postcode: String(pickupPin || ''),
    delivery_postcode: String(deliveryPin || ''),
    weight: String(weightKg || 0.5),
    cod: cod ? '1' : '0',
  }).toString();
  const r = await srFetch(auth.token, 'GET', `/courier/serviceability/?${qs}`, null, 12000);
  if (r.error) return { ok: false, error: r.error };
  const list = r.data?.data?.available_courier_companies || [];
  if (!list.length) return { ok: true, serviceable: false, couriers: [] };
  const couriers = list
    .map((c) => ({ name: c.courier_name, rate: c.rate, cod: c.cod === 1 || c.is_cod_available, etd: c.etd }))
    .sort((a, b) => (a.rate || 0) - (b.rate || 0));
  return { ok: true, serviceable: true, couriers, cheapest: couriers[0] };
}

// Book a parcel: create order → assign AWB → (schedule pickup) → fetch label.
// Returns { ok, awb, courierName, shipmentId, srOrderId, trackingUrl, mode, codAmount, weightKg, labelUrl, error }.
export async function createShipment(settingDoc, order, { weightKg, orderRef } = {}) {
  const cfg = shiprocketConfig(settingDoc);
  if (!shiprocketReady(cfg)) return { ok: false, error: 'Shiprocket is not fully configured (email, password + pickup location required).' };
  const auth = await ensureToken(settingDoc);
  if (!auth.ok) return { ok: false, error: `Shiprocket login failed: ${auth.error}` };

  const addr = order.address || {};
  const mode = orderPaymentMode(order);
  const cod = codAmount(order);
  const kg = estimateWeightKg(cfg, order, weightKg);
  const nameParts = String(order.customer?.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || firstName;
  const phone = String(order.customer?.phone || '').replace(/\D/g, '').slice(-10);

  const payload = {
    order_id: orderRef || order.orderNo,
    order_date: new Date(order.createdAt || Date.now()).toISOString().slice(0, 16).replace('T', ' '),
    pickup_location: cfg.pickupLocation,
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: [addr.line1, addr.line2].filter(Boolean).join(', ') || addr.city || '-',
    billing_address_2: addr.landmark || '',
    billing_city: addr.city || '',
    billing_pincode: String(addr.pincode || '').trim(),
    billing_state: addr.state || '',
    billing_country: 'India',
    billing_email: order.customer?.email || '',
    billing_phone: phone,
    shipping_is_billing: true,
    order_items: (order.items || []).map((it, i) => ({
      name: it.name,
      sku: it.sku || `ITEM-${i + 1}`,
      units: it.qty,
      selling_price: it.price,
    })),
    payment_method: mode === 'COD' ? 'COD' : 'Prepaid',
    sub_total: mode === 'COD' ? cod : Number(order.total || 0),
    length: cfg.dims.length,
    breadth: cfg.dims.breadth,
    height: cfg.dims.height,
    weight: kg,
  };

  const created = await srFetch(auth.token, 'POST', '/orders/create/adhoc', payload);
  const cd = created.data || {};
  const shipmentId = cd.shipment_id;
  const srOrderId = cd.order_id;
  if (!shipmentId) {
    const err = cd.message || (Array.isArray(cd.errors) ? JSON.stringify(cd.errors) : '') || cd.errors || (created.httpOk ? 'Shiprocket rejected the order' : `HTTP ${created.status}`);
    return { ok: false, error: typeof err === 'string' ? err : JSON.stringify(err), raw: cd };
  }

  // Assign an AWB (Shiprocket picks the recommended courier).
  const awbRes = await srFetch(auth.token, 'POST', '/courier/assign/awb', { shipment_id: shipmentId });
  const awbData = awbRes.data?.response?.data || {};
  const awb = awbData.awb_code || awbRes.data?.awb_code;
  if (!awb) {
    const err = awbRes.data?.message || 'Order created but no courier could be assigned (check wallet balance / serviceability). You can retry from Shiprocket.';
    return { ok: false, error: err, shipmentId, srOrderId, raw: awbRes.data };
  }
  const courierName = awbData.courier_name || '';

  // Schedule pickup only if enabled (off by default so test bookings never
  // summon a courier). Real orders turn this on, or schedule from the dashboard.
  if (cfg.autoPickup) {
    srFetch(auth.token, 'POST', '/courier/generate/pickup', { shipment_id: [shipmentId] }).catch(() => {});
  }
  let labelUrl = '';
  const labelRes = await srFetch(auth.token, 'POST', '/courier/generate/label', { shipment_id: [shipmentId] });
  if (labelRes.data?.label_created === 1 || labelRes.data?.label_url) labelUrl = labelRes.data.label_url || '';

  return {
    ok: true,
    awb: String(awb),
    courierName,
    shipmentId: String(shipmentId),
    srOrderId: String(srOrderId || ''),
    trackingUrl: `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`,
    mode,
    codAmount: cod,
    weightKg: kg,
    labelUrl,
    raw: awbData,
  };
}

// Live status by AWB. Returns { ok, status, statusDetail, delivered, error }.
export async function trackShipment(settingDoc, awb) {
  const auth = await ensureToken(settingDoc);
  if (!auth.ok) return { ok: false, error: auth.error };
  const r = await srFetch(auth.token, 'GET', `/courier/track/awb/${encodeURIComponent(awb)}`, null, 10000);
  if (r.error) return { ok: false, error: r.error };
  const td = r.data?.tracking_data || {};
  const track = (td.shipment_track || [])[0] || {};
  const status = track.current_status || (td.track_status === 1 ? 'In transit' : '');
  if (!status) return { ok: false, error: 'No tracking data yet' };
  return {
    ok: true,
    status,
    statusDetail: [track.current_status_body, track.destination].filter(Boolean).join(' · '),
    delivered: /delivered/i.test(status),
  };
}

// Regenerate / fetch the label for an existing shipment.
export async function labelLink(settingDoc, shipmentId) {
  const auth = await ensureToken(settingDoc);
  if (!auth.ok) return { ok: false, error: auth.error };
  const r = await srFetch(auth.token, 'POST', '/courier/generate/label', { shipment_id: [Number(shipmentId)] });
  const url = r.data?.label_url;
  if (!url) return { ok: false, error: r.data?.message || 'Label not ready yet', raw: r.data };
  return { ok: true, url };
}

// Cancel a Shiprocket order (by its internal order id). Returns { ok, error }.
export async function cancelShipment(settingDoc, srOrderId) {
  const auth = await ensureToken(settingDoc);
  if (!auth.ok) return { ok: false, error: auth.error };
  const r = await srFetch(auth.token, 'POST', '/orders/cancel', { ids: [Number(srOrderId)] });
  const ok = r.httpOk && (r.data?.status_code === 200 || /cancel/i.test(JSON.stringify(r.data || {})));
  if (!ok) return { ok: false, error: r.data?.message || 'Could not cancel', raw: r.data };
  return { ok: true, raw: r.data };
}
