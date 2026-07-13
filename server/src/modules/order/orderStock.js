import Product from '../product/product.model.js';
import ApiError from '../../utils/ApiError.js';

// Collapse order lines by product so a product appearing twice reserves its total.
function linesByProduct(items) {
  const m = new Map();
  for (const it of items || []) {
    if (!it.productId) continue;
    const k = String(it.productId);
    m.set(k, (m.get(k) || 0) + it.qty);
  }
  return m;
}

// A product with stockQty > 0 tracks a finite count. stockQty 0 + inStock true =
// untracked / made-to-order (unlimited) — matches resolveItems() semantics.
const isTracked = (p) => (p?.stockQty || 0) > 0;

// Read-only availability probe for the checkout pre-flight — never touches stock.
// Returns { ok, issues:[{ productId, name, image, available, requested }] }.
export async function checkAvailability(items) {
  const need = linesByProduct(items);
  const products = await Product.find({ _id: { $in: [...need.keys()] } }).lean();
  const map = new Map(products.map((p) => [String(p._id), p]));
  const issues = [];
  for (const [id, qty] of need) {
    const p = map.get(id);
    if (!p || p.isActive === false || p.inStock === false) {
      issues.push({ productId: id, name: p?.name || 'Item', image: p?.images?.[0] || '', available: 0, requested: qty });
    } else if (isTracked(p) && qty > p.stockQty) {
      issues.push({ productId: id, name: p.name, image: p.images?.[0] || '', available: p.stockQty, requested: qty });
    }
  }
  return { ok: issues.length === 0, issues };
}

// Add stock back for a set of lines (release a reservation). Never fails.
async function rollback(done) {
  for (const [id, qty] of done) {
    const upd = await Product.findByIdAndUpdate(id, { $inc: { stockQty: qty } }, { new: true });
    if (upd && upd.stockQty > 0 && !upd.inStock) await Product.updateOne({ _id: id }, { inStock: true });
  }
}

// Atomically reserve stock for a set of lines. Each finite-stock line is
// decremented with a guarded update ({ stockQty: { $gte: qty } }) so two
// concurrent buyers can never both take the last unit. On the first shortfall
// it rolls back everything already reserved in this call and throws
// ApiError.conflict({ issues }). Untracked products are left untouched.
export async function reserveProducts(items) {
  const need = linesByProduct(items);
  const done = [];
  for (const [id, qty] of need) {
    const p = await Product.findById(id).lean();
    if (!p || p.isActive === false || p.inStock === false) {
      await rollback(done);
      throw ApiError.conflict('Some items are no longer available', {
        issues: [{ productId: id, name: p?.name || 'Item', image: p?.images?.[0] || '', available: 0, requested: qty }],
      });
    }
    if (!isTracked(p)) continue; // untracked / unlimited — nothing to decrement
    const upd = await Product.findOneAndUpdate(
      { _id: id, stockQty: { $gte: qty } },
      { $inc: { stockQty: -qty } },
      { new: true }
    );
    if (!upd) {
      await rollback(done);
      const cur = await Product.findById(id).lean();
      throw ApiError.conflict('Some items just sold out', {
        issues: [{ productId: id, name: p.name, image: p.images?.[0] || '', available: Math.max(0, cur?.stockQty || 0), requested: qty }],
      });
    }
    if (upd.stockQty <= 0 && upd.inStock) await Product.updateOne({ _id: id }, { inStock: false });
    done.push([id, qty]);
  }
}

// Release a previously-reserved set of lines (order cancelled / hold expired).
export async function releaseProducts(items) {
  await rollback([...linesByProduct(items)]);
}

// Should this order currently be holding stock? Reserve once an order is
// committed (confirmed / shipped / delivered); cancelled releases.
export function shouldReserveStock(order) {
  if (order.status === 'cancelled') return false;
  return ['confirmed', 'shipped', 'delivered'].includes(order.status); // legacy 'pending' excluded
}

// Bring `stockApplied` in line with shouldReserveStock. The reserve direction is
// atomic and may throw ApiError.conflict on a shortfall — callers that mutate an
// order into a reserving state must let that surface (nothing is persisted yet).
// The caller saves the order after this resolves.
export async function reconcileOrderStock(order) {
  const want = shouldReserveStock(order);
  if (want && !order.stockApplied) {
    await reserveProducts(order.items);
    order.stockApplied = true;
  } else if (!want && order.stockApplied) {
    await releaseProducts(order.items);
    order.stockApplied = false;
  }
}
