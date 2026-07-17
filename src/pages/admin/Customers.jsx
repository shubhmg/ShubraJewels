import { useState, useEffect } from 'react'
import { Search, Users, Mail, Phone, MapPin, ShoppingBag, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader } from '../../components/admin/AdminUI.jsx'

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)
const PAGE_LIMIT = 20

const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

// How the customer signs in → coloured badge.
function ProviderBadge({ provider }) {
  const map = {
    'password': { label: 'Password', cls: 'bg-zinc-100 text-zinc-600' },
    'Google': { label: 'Google', cls: 'bg-blue-50 text-blue-600' },
    'password + Google': { label: 'Password + Google', cls: 'bg-emerald-50 text-emerald-700' },
    'none': { label: 'No login', cls: 'bg-amber-50 text-amber-700' },
  }
  const m = map[provider] || map.none
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
}

export function AdminCustomers() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')

  // Debounce the search box → reset to page 1.
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1) }, 350); return () => clearTimeout(t) }, [search])

  useEffect(() => {
    let live = true
    setLoading(true)
    api.get(`/customer/admin/list?search=${encodeURIComponent(q)}&page=${page}&limit=${PAGE_LIMIT}`, { auth: true })
      .then((r) => { if (live) { setRows(r.customers || []); setTotal(r.total || 0) } })
      .catch(() => { if (live) { setRows([]); setTotal(0) } })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [q, page])

  const pages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div>
      <AdminHeader title="Customers" subtitle={`${total} registered account${total === 1 ? '' : 's'}`} />

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--gold)_28%,transparent)]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Users size={32} className="text-zinc-300 mb-3" />
          <p className="text-zinc-500 font-medium">{q ? 'No customers match your search.' : 'No customer accounts yet.'}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl ring-1 ring-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-100">
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Sign-in</th>
                  <th className="px-5 py-3 font-semibold text-center">Orders</th>
                  <th className="px-5 py-3 font-semibold text-right">Spent</th>
                  <th className="px-5 py-3 font-semibold">Last order</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {c.avatar
                          ? <img src={c.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                          : <span className="w-9 h-9 rounded-full grid place-items-center shrink-0 text-white font-semibold text-xs" style={{ background: 'var(--maroon)' }}>{(c.name || c.email || '?').slice(0, 1).toUpperCase()}</span>}
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 truncate">{c.name || '—'}</p>
                          <p className="text-xs text-zinc-500 truncate flex items-center gap-1"><Mail size={11} />{c.email}</p>
                          {c.phone && <p className="text-xs text-zinc-400 truncate flex items-center gap-1"><Phone size={11} />{c.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><ProviderBadge provider={c.provider} /></td>
                    <td className="px-5 py-3.5 text-center font-semibold text-zinc-700">{c.orders}</td>
                    <td className="px-5 py-3.5 text-right font-semibold" style={{ color: 'var(--maroon)' }}>{c.spent > 0 ? fmt(c.spent) : '—'}</td>
                    <td className="px-5 py-3.5 text-zinc-500">{dateFmt(c.lastOrderAt)}</td>
                    <td className="px-5 py-3.5 text-zinc-500">{dateFmt(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5">
            {rows.map((c) => (
              <div key={c.id} className="bg-white rounded-xl ring-1 ring-zinc-200 p-3.5">
                <div className="flex items-center gap-3">
                  {c.avatar
                    ? <img src={c.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    : <span className="w-10 h-10 rounded-full grid place-items-center shrink-0 text-white font-semibold" style={{ background: 'var(--maroon)' }}>{(c.name || c.email || '?').slice(0, 1).toUpperCase()}</span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 justify-between">
                      <p className="font-medium text-zinc-900 truncate">{c.name || '—'}</p>
                      <ProviderBadge provider={c.provider} />
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{c.email}</p>
                    {c.phone && <p className="text-xs text-zinc-400 truncate">{c.phone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500">
                  <span className="flex items-center gap-1"><ShoppingBag size={12} /> {c.orders} order{c.orders === 1 ? '' : 's'}</span>
                  {c.spent > 0 && <span className="font-semibold" style={{ color: 'var(--maroon)' }}>{fmt(c.spent)}</span>}
                  {c.addresses > 0 && <span className="flex items-center gap-1"><MapPin size={12} /> {c.addresses}</span>}
                  <span className="ml-auto">Joined {dateFmt(c.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="w-9 h-9 grid place-items-center rounded-lg border border-zinc-300 bg-white text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 cursor-pointer disabled:cursor-not-allowed"><ChevronLeft size={17} /></button>
              <span className="text-sm text-zinc-500">Page {page} of {pages}</span>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="w-9 h-9 grid place-items-center rounded-lg border border-zinc-300 bg-white text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 cursor-pointer disabled:cursor-not-allowed"><ChevronRight size={17} /></button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
