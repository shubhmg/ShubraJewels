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
