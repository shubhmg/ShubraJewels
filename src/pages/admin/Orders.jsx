import { useEffect, useState } from 'react'
import { Loader2, ChevronDown, ChevronUp, Phone } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader } from '../../components/admin/AdminUI.jsx'
import { Dropdown } from '../../components/ui/Dropdown.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
const STATUS_COLOR = {
  pending: 'bg-amber-50 text-amber-600', confirmed: 'bg-blue-50 text-blue-600',
  shipped: 'bg-violet-50 text-violet-600', delivered: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-red-50 text-red-600',
}

export function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [filter, setFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    setOrders(await api.get('/orders', { auth: true }))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const setStatus = async (id, status) => {
    setOrders((os) => os.map((o) => (o._id === id ? { ...o, status } : o)))
    await api.patch(`/orders/${id}`, { status }, { auth: true })
  }

  const countFor = (s) => (s === 'all' ? orders.length : orders.filter((o) => o.status === s).length)
  const shown = filter === 'all' ? orders : orders.filter((o) => o.status === filter)

  return (
    <div>
      <AdminHeader title="Orders" subtitle={`${orders.length} orders`} />

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...STATUSES].map((s) => {
          const active = filter === s
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition cursor-pointer border ${
                active ? 'bg-gold-500 text-dark-950 border-gold-500' : 'bg-white dark:bg-stone-900 text-stone-500 border-cream-200 dark:border-stone-700 hover:border-gold-400'
              }`}
            >
              {s} <span className={active ? 'opacity-70' : 'text-stone-400'}>({countFor(s)})</span>
            </button>
          )
        })}
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold-500" /></div>
      ) : shown.length === 0 ? (
        <p className="text-center py-20 text-stone-400">{orders.length === 0 ? 'No orders yet.' : `No ${filter} orders.`}</p>
      ) : (
        <div className="space-y-3">
          {shown.map((o) => {
            const isOpen = open === o._id
            const initial = (o.customer?.name || '?').trim()[0]?.toUpperCase() || '?'
            const date = new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            return (
              <div key={o._id} className="admin-row overflow-hidden">
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setOpen(isOpen ? null : o._id)}>
                  <div className="w-11 h-11 rounded-full grid place-items-center text-sm font-bold text-white shrink-0" style={{ background: 'var(--maroon)' }}>{initial}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-zinc-900">{o.orderNo}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_COLOR[o.status]}`}>{o.status}</span>
                    </div>
                    <p className="text-sm text-zinc-700 truncate mt-0.5">{o.customer?.name}</p>
                    <p className="text-xs text-zinc-400">{date} · {o.items?.length} item(s) · {o.channel}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <p className="font-bold text-lg leading-none" style={{ color: 'var(--maroon)' }}>{fmt(o.total)}</p>
                    <span className="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-0.5">
                      {isOpen ? 'Hide' : 'Details'}{isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-zinc-100 bg-zinc-50/60 p-4 space-y-4">
                    <div className="space-y-2">
                      {o.items.map((it, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-white shrink-0 ring-1 ring-zinc-100">
                            {it.image && <img src={it.image} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <span className="flex-1 min-w-0 truncate text-zinc-700">{it.name}</span>
                          <span className="text-zinc-400 text-xs">× {it.qty}</span>
                          <span className="font-semibold text-zinc-900 w-20 text-right">{fmt(it.price * it.qty)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100">
                      <div className="text-sm">
                        <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5 font-bold">Customer</p>
                        <p className="font-medium text-zinc-800">{o.customer?.name}</p>
                        <a href={`tel:${o.customer?.phone}`} className="inline-flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--maroon)' }}><Phone size={12} />{o.customer?.phone}</a>
                        {o.customer?.email && <p className="text-zinc-500">{o.customer.email}</p>}
                        {(o.address?.line1 || o.address?.city) && (
                          <p className="text-zinc-500 mt-2">{[o.address.line1, o.address.line2, o.address.city, o.address.state, o.address.pincode].filter(Boolean).join(', ')}</p>
                        )}
                        {o.notes && <p className="text-zinc-500 mt-2 italic">“{o.notes}”</p>}
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5 font-bold">Update status</p>
                        <Dropdown value={o.status} onChange={(v) => setStatus(o._id, v)} align="left" options={STATUSES.map((s) => ({ value: s, label: s }))} />
                        <p className="text-[11px] text-zinc-400 mt-2">Marking <b>Delivered</b> deducts these items from stock.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
