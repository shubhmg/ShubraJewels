import Product from '../modules/product/product.model.js';
import ApiError from './ApiError.js';

// Resolve cart items against the DB and price them server-side (never trust the
// client's prices). For storefront/payment flows it also rejects products that
// are inactive, sold out, or ordered beyond available stock. Admin bookkeeping
// (manual orders of past/sold-out items) passes requireAvailable:false.
export async function resolveItems(reqItems, { requireAvailable = true, enforceStock = true } = {}) {
  const ids = reqItems.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const map = new Map(products.map((p) => [String(p._id), p]));

  const items = reqItems.map((i) => {
    const p = map.get(String(i.productId));
    if (!p) throw ApiError.badRequest('One or more products are no longer available');
    if (requireAvailable) {
      if (p.isActive === false) throw ApiError.badRequest(`"${p.name}" is no longer available`);
      if (p.inStock === false) throw ApiError.badRequest(`"${p.name}" is sold out`);
      if (enforceStock && p.stockQty > 0 && i.qty > p.stockQty) {
        throw ApiError.badRequest(`Only ${p.stockQty} of "${p.name}" left in stock`);
      }
    }
    return { productId: p._id, name: p.name, image: p.images?.[0] || '', price: p.price, qty: i.qty };
  });

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  return { items, subtotal };
}
