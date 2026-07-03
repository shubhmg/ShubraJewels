import { useState } from 'react'
import { AlertTriangle, TrendingDown, Package, CheckCircle } from 'lucide-react'
import { PRODUCTS } from '../../data/mockData.js'
import { Button } from '../../components/ui/Button.jsx'

export function AdminInventory() {
  const [products, setProducts] = useState(PRODUCTS)
  const [editing, setEditing] = useState(null)
  const [newQty,  setNewQty]  = useState('')

  const critical  = products.filter(p => p.stockQty === 0)
  const low       = products.filter(p => p.stockQty > 0 && p.stockQty <= 5)
  const healthy   = products.filter(p => p.stockQty > 5)

  const updateQty = (id) => {
    const qty = parseInt(newQty)
    if (isNaN(qty) || qty < 0) return
    setProducts(ps => ps.map(p => p.id === id ? { ...p, stockQty: qty, inStock: qty > 0 } : p))
    setEditing(null)
    setNewQty('')
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-serif text-2xl text-dark-900 dark:text-cream-50">Inventory</h1>
        <p className="text-sm text-stone-400 mt-0.5">Track and manage stock levels across all products.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Out of Stock',   count: critical.length, icon: TrendingDown, color: 'text-red-500',   bg: 'bg-red-500/10 border-red-500/20'    },
          { label: 'Low Stock (≤5)', count: low.length,      icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'In Stock',       count: healthy.length,  icon: CheckCircle,  color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        ].map(({ label, count, icon: Icon, color, bg }) => (
          <div key={label} className={`bento-item border ${bg} flex items-center gap-4`}>
            <Icon size={28} className={`${color} flex-shrink-0`} />
            <div>
              <p className="text-2xl font-serif font-bold text-dark-900 dark:text-cream-50">{count}</p>
              <p className="text-xs text-stone-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-cream-200 dark:border-stone-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]" aria-label="Inventory table">
            <thead className="bg-cream-50 dark:bg-stone-800/50 border-b border-cream-200 dark:border-stone-700">
              <tr className="text-xs text-stone-400 uppercase tracking-wider">
                <th className="px-5 py-3 text-left font-semibold">Product</th>
                <th className="px-5 py-3 text-left font-semibold">SKU</th>
                <th className="px-5 py-3 text-center font-semibold">Stock</th>
                <th className="px-5 py-3 text-center font-semibold">Health</th>
                <th className="px-5 py-3 text-right font-semibold">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 dark:divide-stone-800">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-cream-50 dark:hover:bg-stone-800/40 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.images[0]} alt={p.name} className="w-10 h-12 object-cover rounded-lg flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-dark-900 dark:text-cream-100">{p.name}</p>
                        <p className="text-xs text-stone-400">{p.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-stone-400">{p.sku}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`text-lg font-bold ${p.stockQty === 0 ? 'text-red-500' : p.stockQty <= 5 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {p.stockQty}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <div className="w-24 h-2 rounded-full bg-cream-200 dark:bg-stone-700 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${p.stockQty === 0 ? 'bg-red-500' : p.stockQty <= 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, (p.stockQty / 30) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-stone-400">{p.stockQty === 0 ? 'OOS' : p.stockQty <= 5 ? 'Low' : 'OK'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {editing === p.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="number"
                          value={newQty}
                          onChange={e => setNewQty(e.target.value)}
                          placeholder={p.stockQty}
                          className="w-16 px-2 py-1 rounded-lg border border-gold-400 text-sm text-center focus:outline-none bg-white dark:bg-stone-800"
                          aria-label="New stock quantity"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') updateQty(p.id) }}
                        />
                        <Button size="xs" variant="gold" onClick={() => updateQty(p.id)}>Save</Button>
                        <Button size="xs" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditing(p.id); setNewQty(p.stockQty.toString()) }}
                        className="text-xs text-gold-500 hover:text-gold-600 font-medium cursor-pointer"
                        aria-label={`Edit stock for ${p.name}`}
                      >
                        Edit Stock
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
