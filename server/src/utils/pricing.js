// Delivery fee for an order — driven by the admin's shipping config.
// City match is exact + case-insensitive (checkout picks from a fixed list,
// so this is deterministic); unknown cities pay the default charge.
export function computeShipping(settings, city, subtotal) {
  const s = (settings && settings.shipping) || {};
  if (Number(s.freeAboveSubtotal) > 0 && subtotal >= Number(s.freeAboveSubtotal)) return 0;
  const norm = (v) => String(v || '').toLowerCase().trim();
  const match = (s.cities || []).find((c) => norm(c.name) === norm(city));
  if (match) return Math.max(0, Number(match.charge) || 0);
  return Math.max(0, Number(s.defaultCharge) || 0);
}
