import { useEffect, useState } from 'react'
import { Loader2, ChevronDown, ChevronUp, Phone } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader } from '../../components/admin/AdminUI.jsx'

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

  return (
    <div>
      <AdminHeader title="Orders" subtitle={`${orders.length} orders`} />
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold-500" /></div>
      ) : orders.length === 0 ? (
        <p className="text-center py-20 text-stone-400">No orders yet.</p>
      ) : (
        <div className="grid gap-2">
          {orders.map((o) => (
            <div key={o._id} className="bg-white dark:bg-stone-900 rounded-xl border border-cream-200 dark:border-stone-800 overflow-hidden">
              <div className="flex items-center gap-4 px-4 py-3 cursor-pointer" onClick={() => setOpen(open === o._id ? null : o._id)}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-dark-900 dark:text-cream-50">{o.orderNo} <span className="text-stone-400 font-normal">· {o.customer?.name}</span></p>
                  <p className="text-xs text-stone-400">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {o.items?.length} item(s) · {o.channel}</p>
                </div>
                <span className="font-semibold text-dark-900 dark:text-cream-50">{fmt(o.total)}</span>
                <select
                  value={o.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setStatus(o._id, e.target.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border-0 font-medium cursor-pointer ${STATUS_COLOR[o.status]}`}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {open === o._id ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
              </div>
              {open === o._id && (
                <div className="px-4 pb-4 pt-1 border-t border-cream-100 dark:border-stone-800 grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-stone-400 mb-2">Items</p>
                    {o.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm py-1">
                        {it.image && <img src={it.image} alt="" className="w-8 h-8 rounded object-cover" />}
                        <span className="flex-1">{it.name} × {it.qty}</span>
                        <span>{fmt(it.price * it.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm">
                    <p className="text-xs uppercase tracking-wide text-stone-400 mb-2">Customer</p>
                    <p className="font-medium">{o.customer?.name}</p>
                    <a href={`tel:${o.customer?.phone}`} className="flex items-center gap-1.5 text-gold-600 mt-0.5"><Phone size={12} />{o.customer?.phone}</a>
                    {o.customer?.email && <p className="text-stone-500">{o.customer.email}</p>}
                    {(o.address?.line1 || o.address?.city) && (
                      <p className="text-stone-500 mt-2">
                        {[o.address.line1, o.address.line2, o.address.city, o.address.state, o.address.pincode].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {o.notes && <p className="text-stone-500 mt-2 italic">“{o.notes}”</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
