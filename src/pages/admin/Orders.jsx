import { useEffect, useState } from 'react'
import { Loader2, ChevronDown, ChevronUp, Phone, Plus, Minus, Trash2, Check } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn, Modal, Field } from '../../components/admin/AdminUI.jsx'
import { Dropdown } from '../../components/ui/Dropdown.jsx'

const fmtN = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const PAY_METHODS = [
  { value: 'cod', label: 'Cash on delivery' }, { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' }, { value: 'bank', label: 'Bank transfer' },
  { value: 'whatsapp', label: 'WhatsApp' }, { value: 'razorpay', label: 'Razorpay (online)' },
]

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
const STATUS_COLOR = {
  pending: 'bg-amber-50 text-amber-600', confirmed: 'bg-blue-50 text-blue-600',
  shipped: 'bg-violet-50 text-violet-600', delivered: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-red-50 text-red-600',
}

// Payment badge — Paid (Razorpay or collected on delivery), else COD / WhatsApp.
function payBadge(o) {
  if (o.paymentStatus === 'paid') return { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' }
  if (o.paymentMethod === 'whatsapp') return { label: 'WhatsApp', cls: 'bg-green-100 text-green-700' }
  return { label: 'COD', cls: 'bg-amber-100 text-amber-700' }
}

export function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [filter, setFilter] = useState('all')
  const [newOpen, setNewOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    setOrders(await api.get('/orders', { auth: true }))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Any admin patch (status / payment) — reconcile with the server response
  // so auto-effects (stock deduction, COD→paid on delivery) reflect.
  const patchOrder = async (id, patch) => {
    setOrders((os) => os.map((o) => (o._id === id ? { ...o, ...patch } : o)))
    const updated = await api.patch(`/orders/${id}`, patch, { auth: true })
    setOrders((os) => os.map((o) => (o._id === id ? updated : o)))
  }
  const setStatus = (id, status) => patchOrder(id, { status })

  const countFor = (s) => (s === 'all' ? orders.length : orders.filter((o) => o.status === s).length)
  const shown = filter === 'all' ? orders : orders.filter((o) => o.status === filter)

  return (
    <div>
      <AdminHeader title="Orders" subtitle={`${orders.length} orders`}>
        <Btn onClick={() => setNewOpen(true)}><Plus size={16} /> New Order</Btn>
      </AdminHeader>
      {newOpen && <NewOrderModal onClose={() => setNewOpen(false)} onCreated={load} />}

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
                      {(() => { const b = payBadge(o); return <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${b.cls}`}>{b.label}</span> })()}
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
                        <p className="text-[11px] text-zinc-400 mt-2">Marking <b>Delivered</b> deducts stock and marks the order paid.</p>

                        <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5 font-bold mt-4">Payment</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Dropdown value={o.paymentMethod || 'cod'} onChange={(v) => patchOrder(o._id, { paymentMethod: v })} align="left" options={PAY_METHODS} />
                          <button
                            onClick={() => patchOrder(o._id, { paymentStatus: o.paymentStatus === 'paid' ? 'unpaid' : 'paid' })}
                            className={`px-3.5 py-2 rounded-full text-xs font-bold cursor-pointer transition ${o.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                          >
                            {o.paymentStatus === 'paid' ? <><Check size={13} className="inline -mt-0.5" /> Paid</> : 'Mark paid'}
                          </button>
                        </div>
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

// Manually log an order (e.g. from WhatsApp) with real line items + payment.
function NewOrderModal({ onClose, onCreated }) {
  const [products, setProducts] = useState([])
  const [lines, setLines] = useState([])
  const [cust, setCust] = useState({ name: '', phone: '', email: '' })
  const [addr, setAddr] = useState({ line1: '', city: '', pincode: '' })
  const [status, setStatus] = useState('pending')
  const [method, setMethod] = useState('whatsapp')
  const [paid, setPaid] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => { api.get('/products?all=1', { auth: true }).then(setProducts) }, [])

  const addLine = (id) => {
    const p = products.find((x) => x._id === id)
    if (!p) return
    setLines((ls) => {
      const ex = ls.find((l) => l.productId === id)
      if (ex) return ls.map((l) => (l.productId === id ? { ...l, qty: l.qty + 1 } : l))
      return [...ls, { productId: id, name: p.name, price: p.price, qty: 1 }]
    })
  }
  const setQty = (id, qty) => setLines((ls) => (qty < 1 ? ls.filter((l) => l.productId !== id) : ls.map((l) => (l.productId === id ? { ...l, qty } : l))))
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)

  const save = async () => {
    if (!lines.length) return setErr('Add at least one product')
    if (!cust.name.trim() || !cust.phone.trim()) return setErr('Customer name and phone are required')
    setSaving(true); setErr(null)
    try {
      await api.post('/orders/manual', {
        items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        customer: { name: cust.name.trim(), phone: cust.phone.trim(), email: cust.email.trim() },
        address: addr, status, paymentMethod: method, paymentStatus: paid ? 'paid' : 'unpaid', notes,
      }, { auth: true })
      onCreated(); onClose()
    } catch (e) { setErr(e.details?.join(', ') || e.message) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="Log an order" wide footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : `Create · ${fmtN(total)}`}</Btn>
    </>}>
      <div>
        <p className="text-[13px] font-medium text-zinc-700 mb-1.5">Products</p>
        <div className="space-y-2 mb-2">
          {lines.map((l) => (
            <div key={l.productId} className="flex items-center gap-2 bg-zinc-50 rounded-lg px-3 py-2">
              <span className="flex-1 min-w-0 truncate text-sm">{l.name}</span>
              <span className="text-xs text-zinc-400">{fmtN(l.price)}</span>
              <div className="flex items-center rounded-full border border-zinc-200">
                <button onClick={() => setQty(l.productId, l.qty - 1)} className="w-7 h-7 grid place-items-center text-zinc-500 cursor-pointer"><Minus size={13} /></button>
                <span className="w-7 text-center text-sm">{l.qty}</span>
                <button onClick={() => setQty(l.productId, l.qty + 1)} className="w-7 h-7 grid place-items-center text-zinc-500 cursor-pointer"><Plus size={13} /></button>
              </div>
              <button onClick={() => setQty(l.productId, 0)} className="text-zinc-400 hover:text-red-500 cursor-pointer"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <Dropdown value="" onChange={addLine} align="left" className="w-full" options={products.map((p) => ({ value: p._id, label: `${p.name} · ${fmtN(p.price)}` }))} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field field={{ label: 'Customer name', required: true }} value={cust.name} onChange={(v) => setCust({ ...cust, name: v })} />
        <Field field={{ label: 'Phone', required: true }} value={cust.phone} onChange={(v) => setCust({ ...cust, phone: v })} />
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field field={{ label: 'City' }} value={addr.city} onChange={(v) => setAddr({ ...addr, city: v })} />
        <Field field={{ label: 'PIN' }} value={addr.pincode} onChange={(v) => setAddr({ ...addr, pincode: v })} />
        <Field field={{ label: 'Email (optional)' }} value={cust.email} onChange={(v) => setCust({ ...cust, email: v })} />
      </div>
      <Field field={{ label: 'Address (optional)' }} value={addr.line1} onChange={(v) => setAddr({ ...addr, line1: v })} />

      <div className="grid sm:grid-cols-2 gap-3">
        <Field field={{ label: 'Status', type: 'select', options: STATUSES.map((s) => ({ value: s, label: s })) }} value={status} onChange={setStatus} />
        <Field field={{ label: 'Payment method', type: 'select', options: PAY_METHODS.filter((m) => m.value !== 'razorpay') }} value={method} onChange={setMethod} />
      </div>
      <Field field={{ label: 'Already paid', type: 'toggle' }} value={paid} onChange={setPaid} />
      <Field field={{ label: 'Notes', type: 'textarea' }} value={notes} onChange={setNotes} />
      {err && <p className="text-sm text-red-600">{err}</p>}
    </Modal>
  )
}
