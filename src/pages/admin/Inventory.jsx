import { useEffect, useState } from 'react'
import { Loader2, Search, Minus, Plus, AlertTriangle } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader } from '../../components/admin/AdminUI.jsx'

const LOW = 5 // low-stock threshold
const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)

export function AdminInventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await api.get('/products?all=1', { auth: true })
    setItems(data.sort((a, b) => (a.stockQty || 0) - (b.stockQty || 0)))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Optimistic update + persist.
  const setStock = async (id, qty) => {
    const v = Math.max(0, Math.round(Number(qty) || 0))
    setItems((xs) => xs.map((p) => (p._id === id ? { ...p, stockQty: v, inStock: v > 0 } : p)))
    await api.patch(`/products/${id}`, { stockQty: v }, { auth: true })
  }

  const filtered = items.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false
    if (onlyLow && (p.stockQty || 0) > LOW) return false
    return true
  })
  const lowCount = items.filter((p) => (p.stockQty || 0) <= LOW).length

  const tag = (n) => (n <= 0
    ? { label: 'Out', cls: 'bg-red-50 text-red-600' }
    : n <= LOW ? { label: 'Low', cls: 'bg-amber-50 text-amber-600' }
      : { label: 'In stock', cls: 'bg-emerald-50 text-emerald-600' })

  return (
    <div>
      <AdminHeader title="Inventory" subtitle={`${items.length} products · ${lowCount} low or out of stock`} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[10rem] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm focus:outline-none" />
        </div>
        <button onClick={() => setOnlyLow((v) => !v)} className={`px-3.5 py-2 rounded-xl text-sm font-semibold border cursor-pointer inline-flex items-center gap-1.5 ${onlyLow ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-stone-900 text-stone-500 border-cream-200 dark:border-stone-700'}`}>
          <AlertTriangle size={14} /> Low stock{lowCount ? ` (${lowCount})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold-500" /></div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => {
            const n = p.stockQty || 0
            const t = tag(n)
            return (
              <div key={p._id} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-cream-200 dark:border-stone-800 p-3">
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 flex-shrink-0">
                  {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-dark-900 dark:text-cream-50 truncate">{p.name}</p>
                  <p className="text-xs text-stone-400">{p.sku ? `${p.sku} · ` : ''}{fmt(p.price)}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${t.cls} hidden xs:inline sm:inline`}>{t.label}</span>
                <div className="flex items-center rounded-full border border-stone-200 dark:border-stone-700 overflow-hidden">
                  <button onClick={() => setStock(p._id, n - 1)} className="w-8 h-8 grid place-items-center text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"><Minus size={14} /></button>
                  <input
                    type="number"
                    value={n}
                    onChange={(e) => setItems((xs) => xs.map((x) => (x._id === p._id ? { ...x, stockQty: e.target.value } : x)))}
                    onBlur={(e) => setStock(p._id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    className="w-12 text-center text-sm bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => setStock(p._id, Number(n) + 1)} className="w-8 h-8 grid place-items-center text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"><Plus size={14} /></button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <p className="text-center py-16 text-stone-400 text-sm">No products.</p>}
        </div>
      )}
    </div>
  )
}
