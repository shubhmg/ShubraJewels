// Xpressbees integration. Config lives in the Settings doc (`xpressbees`).
// Xpressbees authenticates with the account email + password (both SECRET —
// stripped from the public GET /settings) to mint a JWT valid ~3 hours; we
// cache it on the settings doc (`xpressbees.token` + `tokenExpiry`) and refresh
// transparently when it expires.
//
// Unlike Shiprocket's 3-step dance, booking is ONE call: POST /shipments2
// creates the order, assigns the AWB, and returns the label PDF URL directly.
// The pickup warehouse is passed inline in the payload (no pre-registration).
// Weights are in GRAMS (like Delhivery), dims in cm.

const BASE = 'https://shipment.xpressbees.com/api';

export function xpressbeesConfig(settings) {
  const x = settings?.xpressbees?.toObject?.() ?? settings?.xpressbees ?? {};
  return {
    enabled: !!x.enabled,
    email: x.email || '',
    password: x.password || '',
    policy: x.policy || 'manual',
    autoPickup: !!x.autoPickup, // request_auto_pickup on booking
    webhookToken: x.webhookToken || '',
    warehouseName: x.warehouseName || 'Primary',
    pickup: {
      name: x.pickupName || settings?.brandName || 'Shubra Jewels',
      phone: x.pickupPhone || '',
      address: x.pickupAddress || '',
      city: x.pickupCity || '',
      state: x.pickupState || '',
      pin: x.pickupPin || '',
    },
    defaultWeightGrams: Number(x.defaultWeightGrams) || 100,
    dims: {
      length: Number(x.length) || 12,
      breadth: Number(x.breadth) || 10,
      height: Number(x.height) || 5,
    },
  };
}

export function xpressbeesReady(cfg) {
  return cfg.enabled && !!cfg.email && !!cfg.password
    && !!cfg.pickup.address && !!cfg.pickup.pin && !!cfg.pickup.phone;
}

// Prepaid vs COD from the order's payment method/status.
export function orderPaymentMode(order) {
  const paid = order.paymentStatus === 'paid';
  const isCod = ['cod', 'cash'].includes(order.paymentMethod);
  return paid || !isCod ? 'Prepaid' : 'COD';
}

export function shouldAutoShip(cfg, order) {
  if (!xpressbeesReady(cfg)) return false;
  const mode = orderPaymentMode(order);
  switch (cfg.policy) {
    case 'all': return true;
    case 'cod': return mode === 'COD';
    case 'prepaid': return mode === 'Prepaid';
    default: return false;
  }
}

// COD collectible = total − advance (COD only).
function codAmount(order) {
  if (orderPaymentMode(order) !== 'COD') return 0;
  return Math.max(0, Number(order.total || 0) - Number(order.advancePaid || 0));
}

// Order weight in grams: per-order override, else defaultWeightGrams × total qty.
export function estimateWeight(cfg, order, override) {
  if (override && Number(override) > 0) return Math.round(Number(override));
  const qty = (order.items || []).reduce((a, i) => a + (i.qty || 0), 0) || 1;
  return Math.max(1, Math.round(cfg.defaultWeightGrams * qty));
}

async function xbFetch(token, method, path, body, timeout = 15000) {
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

// Return a valid Xpressbees JWT, refreshing (and persisting) it when expired.
// The JWT lives ~3h — cache for 2.5h and refresh when <10 min remain.
export async function ensureToken(settingDoc) {
  const cfg = xpressbeesConfig(settingDoc);
  if (!cfg.email || !cfg.password) return { ok: false, error: 'Xpressbees email/password not set' };

  const x = settingDoc.xpressbees || {};
  const now = Date.now();
  const exp = x.tokenExpiry ? new Date(x.tokenExpiry).getTime() : 0;
  if (x.token && exp > now + 10 * 60 * 1000) return { ok: true, token: x.token };

  const r = await xbFetch(null, 'POST', '/users/login', { email: cfg.email, password: cfg.password });
  const token = r.data?.status === true ? r.data?.data : null;
  if (!token || typeof token !== 'string') {
    return { ok: false, error: r.data?.message || (r.httpOk ? 'Login failed' : `HTTP ${r.status}`) };
  }
  settingDoc.xpressbees.token = token;
  settingDoc.xpressbees.tokenExpiry = new Date(now + 2.5 * 60 * 60 * 1000);
  settingDoc.markModified('xpressbees');
  try { await settingDoc.save(); } catch { /* cache best-effort */ }
  return { ok: true, token };
}

// Serviceability + rates between the pickup PIN and a delivery PIN. Returns
// { ok, serviceable, couriers: [{ id, name, rate, codCharges, chargeableWeightGrams }], cheapest }.
// Pass a courier `id` back as `courierId` when booking to force that service.
export async function checkServiceability(settingDoc, { deliveryPin, weightGrams, cod, orderAmount }) {
  const cfg = xpressbeesConfig(settingDoc);
  if (!cfg.pickup.pin) return { ok: false, error: 'Set the Xpressbees pickup PIN first' };
  const auth = await ensureToken(settingDoc);
  if (!auth.ok) return { ok: false, error: auth.error };

  const r = await xbFetch(auth.token, 'POST', '/courier/serviceability', {
    origin: String(cfg.pickup.pin),
    destination: String(deliveryPin || ''),
    payment_type: cod ? 'cod' : 'prepaid',
    order_amount: String(orderAmount || 500),
    weight: String(Math.max(1, Math.round(weightGrams || cfg.defaultWeightGrams))),
    length: String(cfg.dims.length),
    breadth: String(cfg.dims.breadth),
    height: String(cfg.dims.height),
  }, 12000);
  if (r.error) return { ok: false, error: r.error };
  const list = Array.isArray(r.data?.data) ? r.data.data : [];
  if (!r.data?.status || !list.length) return { ok: true, serviceable: false, couriers: [] };
  const couriers = list
    .map((c) => ({
      id: String(c.id),
      name: c.name,
      rate: Number(c.total_charges) || 0,
      freight: Number(c.freight_charges) || 0,
      codCharges: Number(c.cod_charges) || 0,
      chargeableWeightGrams: Number(c.chargeable_weight) || 0,
    }))
    .sort((a, b) => a.rate - b.rate);
  return { ok: true, serviceable: true, couriers, cheapest: couriers[0] };
}

// Book a shipment — ONE call creates the order, assigns the AWB, and returns the
// label. Returns { ok, awb, courierName, shipmentId, labelUrl, manifestUrl,
// trackingUrl, mode, codAmount, weightGrams, error }.
export async function createShipment(settingDoc, order, { weight, orderRef, courierId } = {}) {
  const cfg = xpressbeesConfig(settingDoc);
  if (!xpressbeesReady(cfg)) return { ok: false, error: 'Xpressbees is not fully configured (email, password + pickup address/PIN/phone required).' };
  const auth = await ensureToken(settingDoc);
  if (!auth.ok) return { ok: false, error: `Xpressbees login failed: ${auth.error}` };

  const addr = order.address || {};
  const mode = orderPaymentMode(order);
  const cod = codAmount(order);
  const grams = estimateWeight(cfg, order, weight);
  const phone = String(order.customer?.phone || '').replace(/\D/g, '').slice(-10);

  const payload = {
    order_number: orderRef || order.orderNo,
    unique_order_number: 'yes',
    shipping_charges: Number(order.shipping || 0),
    discount: Number(order.discount || 0),
    cod_charges: 0,
    payment_type: mode === 'COD' ? 'cod' : 'prepaid',
    order_amount: Number(order.total || 0),
    package_weight: grams,
    package_length: cfg.dims.length,
    package_breadth: cfg.dims.breadth,
    package_height: cfg.dims.height,
    request_auto_pickup: cfg.autoPickup ? 'yes' : 'no',
    consignee: {
      name: order.customer?.name || 'Customer',
      address: [addr.line1, addr.line2].filter(Boolean).join(', ') || addr.city || '-',
      address_2: addr.landmark || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: String(addr.pincode || '').trim(),
      phone,
    },
    pickup: {
      warehouse_name: cfg.warehouseName,
      name: cfg.pickup.name,
      address: cfg.pickup.address,
      address_2: '',
      city: cfg.pickup.city,
      state: cfg.pickup.state,
      pincode: String(cfg.pickup.pin),
      phone: cfg.pickup.phone,
    },
    order_items: (order.items || []).map((it, i) => ({
      name: it.name,
      qty: String(it.qty || 1),
      price: String(it.price || 0),
      sku: it.sku || `ITEM-${i + 1}`,
    })),
    courier_id: courierId ? String(courierId) : '',
    collectable_amount: String(cod),
  };

  const r = await xbFetch(auth.token, 'POST', '/shipments2', payload, 20000);
  const d = r.data?.data || {};
  const awb = d.awb_number;
  if (!r.data?.status || !awb) {
    const err = r.data?.message
      || (r.data?.data && typeof r.data.data === 'string' ? r.data.data : '')
      || (r.httpOk ? 'Xpressbees rejected the shipment' : `HTTP ${r.status}`);
    return { ok: false, error: typeof err === 'string' ? err : JSON.stringify(err), raw: r.data };
  }

  return {
    ok: true,
    awb: String(awb),
    courierName: d.courier_name || 'Xpressbees',
    shipmentId: String(d.shipment_id || ''),
    xbOrderId: String(d.order_id || ''),
    labelUrl: d.label || '',
    manifestUrl: d.manifest || '',
    trackingUrl: trackingUrl(awb),
    mode,
    codAmount: cod,
    weightGrams: grams,
    raw: d,
  };
}

// Live status by AWB. Returns { ok, status, statusDetail, delivered, error }.
export async function trackShipment(settingDoc, awb) {
  const auth = await ensureToken(settingDoc);
  if (!auth.ok) return { ok: false, error: auth.error };
  const r = await xbFetch(auth.token, 'GET', `/shipments2/track/${encodeURIComponent(awb)}`, null, 10000);
  if (r.error) return { ok: false, error: r.error };
  const d = r.data?.data || {};
  const status = d.status || '';
  if (!r.data?.status || !status) return { ok: false, error: r.data?.message || 'No tracking data yet' };
  const latest = (d.history || [])[0] || {};
  return {
    ok: true,
    status,
    statusDetail: [latest.message, latest.location].filter(Boolean).join(' · '),
    delivered: /delivered/i.test(status) && !/rto/i.test(status),
  };
}

// Cancel a shipment by AWB. Returns { ok, error }.
export async function cancelShipment(settingDoc, awb) {
  const auth = await ensureToken(settingDoc);
  if (!auth.ok) return { ok: false, error: auth.error };
  const r = await xbFetch(auth.token, 'POST', '/shipments2/cancel', { awb: String(awb) });
  const ok = r.data?.status === true || /cancel/i.test(String(r.data?.message || ''));
  if (!ok) return { ok: false, error: r.data?.message || 'Could not cancel', raw: r.data };
  return { ok: true, raw: r.data };
}

// Manifest / pickup sheet for a batch of AWBs. Returns { ok, url, error }.
export async function generateManifest(settingDoc, awbs) {
  const auth = await ensureToken(settingDoc);
  if (!auth.ok) return { ok: false, error: auth.error };
  const r = await xbFetch(auth.token, 'POST', '/shipments2/manifest', { awbs: awbs.map(String) });
  const url = typeof r.data?.data === 'string' ? r.data.data : (r.data?.data?.manifest || r.data?.manifest || '');
  if (!r.data?.status || !url) return { ok: false, error: r.data?.message || 'Manifest not ready', raw: r.data };
  return { ok: true, url };
}

// Public tracking URL a customer can open.
export function trackingUrl(awb) {
  return `https://www.xpressbees.com/shipment/tracking?awbNo=${encodeURIComponent(awb)}`;
}
