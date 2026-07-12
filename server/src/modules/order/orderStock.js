import Product from '../product/product.model.js';

// Adjust product stock by a signed multiplier (+1 restock, -1 reserve); clamps at 0.
export async function applyOrderStock(order, sign) {
  for (const it of order.items) {
    if (!it.productId) continue;
    const p = await Product.findById(it.productId);
    if (!p) continue;
    p.stockQty = Math.max(0, (p.stockQty || 0) + sign * it.qty);
    p.inStock = p.stockQty > 0;
    await p.save();
  }
}

// Should this order currently be holding stock? Reserve once an order is
// committed (confirmed / shipped / delivered); cancelled releases.
export function shouldReserveStock(order) {
  if (order.status === 'cancelled') return false;
  return ['confirmed', 'shipped', 'delivered'].includes(order.status); // legacy 'pending' excluded
}

// Bring `stockApplied` in line with shouldReserveStock. Mutates the order
// (deducting/restoring product stock as needed); the caller saves it.
export async function reconcileOrderStock(order) {
  const want = shouldReserveStock(order);
  if (want && !order.stockApplied) {
    await applyOrderStock(order, -1);
    order.stockApplied = true;
  } else if (!want && order.stockApplied) {
    await applyOrderStock(order, +1);
    order.stockApplied = false;
  }
}
