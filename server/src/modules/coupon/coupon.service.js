import Coupon from './coupon.model.js';

// Discount amount (₹, rounded) a coupon yields for a given subtotal.
export function discountFor(coupon, subtotal) {
  let d = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.type === 'percent' && coupon.maxDiscount > 0) d = Math.min(d, coupon.maxDiscount);
  d = Math.min(d, subtotal); // never discount below zero
  return Math.max(0, Math.round(d));
}

// Validate a code against a subtotal. Returns { discount, coupon } or { error }.
export async function resolveCoupon(code, subtotal) {
  if (!code) return { discount: 0, coupon: null };
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
  if (!coupon || !coupon.isActive) return { error: 'Invalid coupon code' };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { error: 'This coupon has expired' };
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return { error: 'This coupon is no longer available' };
  if (subtotal < coupon.minSubtotal) return { error: `Minimum order of ₹${coupon.minSubtotal} to use this code` };
  return { discount: discountFor(coupon, subtotal), coupon };
}
