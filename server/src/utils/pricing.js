// Delivery fee for an order — driven by the admin's shipping config.
// `addr` may be a city string (legacy) or an { city, state } object. Matching is
// tolerant so a configured "Delhi" also matches PIN-derived districts like
// "North West Delhi" (substring) and the state "Delhi" (fallback).
export function computeShipping(settings, addr, subtotal) {
  const s = (settings && settings.shipping) || {};
  if (Number(s.freeAboveSubtotal) > 0 && subtotal >= Number(s.freeAboveSubtotal)) return 0;
  const norm = (v) => String(v || '').toLowerCase().trim();
  const city = norm(typeof addr === 'string' ? addr : addr?.city);
  const state = norm(typeof addr === 'object' && addr ? addr.state : '');
  const match = (s.cities || []).find((c) => {
    const n = norm(c.name);
    if (!n) return false;
    return n === city || n === state || (!!city && (city.includes(n) || n.includes(city)));
  });
  if (match) return Math.max(0, Number(match.charge) || 0);
  return Math.max(0, Number(s.defaultCharge) || 0);
}

// Shipping + COD fee for an order, given the payment method. Prepaid methods
// (razorpay/upi) get free shipping when `prepaidFreeShipping` is on; COD adds
// the flat `codFee`. Returns { shipping, codFee }.
export function computeCharges(settings, address, paymentMethod, subtotal) {
  const pay = (settings && settings.payments) || {};
  const base = computeShipping(settings, address, subtotal);
  const prepaid = paymentMethod === 'razorpay' || paymentMethod === 'upi';
  const shipping = (prepaid && pay.prepaidFreeShipping) ? 0 : base;
  const codFee = paymentMethod === 'cod' ? Math.max(0, Number(pay.codFee) || 0) : 0;
  return { shipping, codFee };
}
