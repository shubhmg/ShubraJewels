import { useEffect, useState } from 'react'
import { Loader2, Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader } from '../../components/admin/AdminUI.jsx'
import { Dropdown } from '../../components/ui/Dropdown.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const nf = (n) => new Intl.NumberFormat('en-IN').format(n || 0)
const LIMIT = 20

export function AdminProductViews() {
  const [days, setDays] = useState(30)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Debounce the search box; reset to page 1 on new query/range.
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1) }, 350); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1) }, [days])

  useEffect(() => {
    setLoading(true)
    api.get(`/analytics/product-views?days=${days}&page=${page}&limit=${LIMIT}&search=${encodeURIComponent(q)}`, { auth: true })
      .then(setData)
      .finally(() => setLoading(false))
  }, [days, page, q])

  const items = data?.items || []
  const total = data?.total || 0
  const pages = Math.max(1, Math.ceil(total / LIMIT))
  const maxViews = Math.max(...items.map((i) => i.views), 1)
  const rankBase = (page - 1) * LIMIT

  return (
    <div>
      <AdminHeader title="Product Views" subtitle={`${nf(total)} product${total === 1 ? '' : 's'} · last ${days} days`}>
        <Dropdown value={days} onChange={setDays} options={[7, 30, 90, 365].map((d) => ({ value: d, label: `Last ${d} days` }))} />
      </AdminHeader>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--gold)_28%,transparent)]"
        />
      </div>

      <div className="admin-card p-2 md:p-3">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--gold)' }} /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-zinc-400 py-16 text-sm">{q ? 'No matching products.' : 'No product views yet.'}</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {items.map((it, idx) => (
              <div key={it.id} className="flex items-center gap-3 p-2 md:p-3">
                <span className="w-6 text-center text-xs font-bold text-zinc-400 shrink-0">{rankBase + idx + 1}</span>
                {it.image
                  ? <img src={it.image} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                  : <div className="w-11 h-11 rounded-lg bg-zinc-100 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-800 truncate">{it.name}</p>
                  <p className="text-xs text-zinc-400">{fmt(it.price)}</p>
                  <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden mt-1.5 max-w-[220px]">
                    <div className="h-full rounded-full" style={{ width: `${(it.views / maxViews) * 100}%`, background: 'linear-gradient(90deg, var(--gold), var(--gold-light))' }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-zinc-900 leading-none">{nf(it.views)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-400 mt-0.5 flex items-center gap-1 justify-end"><Eye size={11} /> views</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-zinc-400">Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="w-9 h-9 grid place-items-center rounded-lg border border-zinc-300 bg-white disabled:opacity-40 cursor-pointer"><ChevronLeft size={16} /></button>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="w-9 h-9 grid place-items-center rounded-lg border border-zinc-300 bg-white disabled:opacity-40 cursor-pointer"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
