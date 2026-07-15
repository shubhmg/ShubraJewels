import { useEffect, useState } from 'react'
import { Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Phone, Plus, Minus, Trash2, Check, Search, Truck, PackageCheck, ExternalLink, RefreshCw, XCircle, FileText, Package } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn, Modal, Field } from '../../components/admin/AdminUI.jsx'
import { Dropdown } from '../../components/ui/Dropdown.jsx'

const PAGE_LIMIT = 20

const fmtN = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const PAY_METHODS = [
  { value: 'cod', label: 'Cash on delivery' }, { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' }, { value: 'bank', label: 'Bank transfer' },
  { value: 'razorpay', label: 'Razorpay (online)' },
]

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
// 'pending' kept for legacy orders only; new orders start Confirmed.
const STATUSES = ['confirmed', 'shipped', 'delivered', 'cancelled']
const STATUS_COLOR = {
  pending: 'bg-blue-50 text-blue-600', confirmed: 'bg-blue-50 text-blue-600',
  shipped: 'bg-violet-50 text-violet-600', delivered: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-red-50 text-red-600',
}
// Left-edge colour spine per status — instant visual scan.
const STATUS_SPINE = {
  pending: '#3b82f6', confirmed: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
}

// The single next-step action for an order (drives the primary button).
function nextAction(status) {
  if (status === 'pending' || status === 'confirmed') return { label: 'Mark Shipped', to: 'shipped', ship: true, icon: Truck }
  if (status === 'shipped') return { label: 'Mark Delivered', to: 'delivered', icon: PackageCheck }
  return null
}

// Compact horizontal stepper for the order detail.
const STAGES = [{ key: 'confirmed', label: 'Confirmed' }, { key: 'shipped', label: 'Shipped' }, { key: 'delivered', label: 'Delivered' }]
function Stepper({ status }) {
  if (status === 'cancelled') return <span className="text-xs font-bold text-red-600">✖ Cancelled</span>
  const idx = Math.max(0, STAGES.findIndex((s) => s.key === status))
  return (
    <div className="flex items-center">
      {STAGES.map((s, i) => {
        const done = i <= idx
        const isLast = i === STAGES.length - 1
        return (
          <div key={s.key} className="flex items-center" style={{ flex: isLast ? '0 0 auto' : 1 }}>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full grid place-items-center shrink-0" style={{ background: done ? 'var(--maroon)' : '#e7e5e4', color: '#fff' }}>
                {done ? <Check size={12} /> : <span className="w-1 h-1 rounded-full bg-stone-400" />}
              </div>
              <span className="text-[11px] font-semibold" style={{ color: done ? 'var(--ink)' : '#a8a29e' }}>{s.label}</span>
            </div>
            {!isLast && <div className="h-0.5 flex-1 mx-2 rounded-full" style={{ background: i < idx ? 'var(--maroon)' : '#e7e5e4' }} />}
          </div>
        )
      })}
    </div>
  )
}

// Prepaid vs COD for an order (mirrors the server's orderPaymentMode).
const paymentMode = (o) => (o.paymentStatus === 'paid' || !['cod', 'cash', 'none'].includes(o.paymentMethod) ? 'Prepaid' : 'COD')
// Does the admin's Delhivery policy auto-route THIS order?
const policyApplies = (cfg, o) => {
  if (!cfg?.ready) return false
  const m = paymentMode(o)
  if (cfg.policy === 'all') return true
  if (cfg.policy === 'cod') return m === 'COD'
  if (cfg.policy === 'prepaid') return m === 'Prepaid'
  return false
}
const trackUrl = (wb) => `https://www.delhivery.com/track/package/${encodeURIComponent(wb)}`

// Payment badge — Paid, advance-paid COD, else COD.
function payBadge(o) {
  if (o.paymentStatus === 'paid') return { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' }
  if (o.advancePaid > 0) return { label: 'Advance paid', cls: 'bg-blue-100 text-blue-700' }
  if (o.paymentMethod === 'upi') return { label: 'UPI', cls: 'bg-blue-100 text-blue-700' }
  return { label: 'COD', cls: 'bg-amber-100 text-amber-700' }
}

export function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [counts, setCounts] = useState({ all: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [filter, setFilter] = useState('confirmed')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [shipFor, setShipFor] = useState(null) // order being marked shipped (tracking form)
  const [delCfg, setDelCfg] = useState(null)   // Delhivery config (enabled/policy/ready)
  const [srCfg, setSrCfg] = useState(null)     // Shiprocket config (enabled/policy/ready)

  const [wiping, setWiping] = useState(false)

  // Courier config drives the ship flow (auto-book vs manual). Read from the
  // admin settings endpoint (the tokens/passwords stay server-side).
  useEffect(() => {
    api.get('/settings/admin', { auth: true })
      .then((s) => {
        const d = s?.delhivery || {}
        setDelCfg({
          enabled: !!d.enabled,
          policy: d.policy || 'manual',
          hasToken: !!d.token,
          hasPickup: !!d.pickupName,
          ready: !!(d.enabled && d.token && d.pickupName),
          defaultWeightGrams: Number(d.defaultWeightGrams) || 100,
        })
        const r = s?.shiprocket || {}
        setSrCfg({
          enabled: !!r.enabled,
          policy: r.policy || 'manual',
          hasCreds: !!(r.email && r.password),
          hasPickup: !!r.pickupLocation,
          hasPin: !!r.pickupPin,
          ready: !!(r.enabled && r.email && r.password && r.pickupLocation),
          defaultWeightKg: Number(r.defaultWeightKg) || 0.3,
        })
      })
      .catch(() => { setDelCfg({ enabled: false, ready: false }); setSrCfg({ enabled: false, ready: false }) })
  }, [])

  // Debounced search; reset to page 1 on new query/filter.
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1) }, 350); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1) }, [filter])

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    const statusParam = filter === 'all' ? '' : filter
    const res = await api.get(`/orders?status=${statusParam}&search=${encodeURIComponent(q)}&page=${page}&limit=${PAGE_LIMIT}`, { auth: true })
    setOrders(res.items || [])
    setCounts(res.counts || { all: 0 })
    setTotal(res.total || 0)
    setLoading(false)
  }
  useEffect(() => { load() }, [filter, q, page]) // eslint-disable-line

  // Pre-launch cleanup: wipe all (test) orders.
  const deleteAll = async () => {
    if ((counts.all || 0) === 0) return
    if (!window.confirm(`Delete ALL ${counts.all} orders permanently? This is for pre-launch testing cleanup and cannot be undone.`)) return
    setWiping(true)
    try {
      const res = await api.post('/orders/delete-all', { confirm: 'DELETE_ALL' }, { auth: true })
      setPage(1)
      await load()
      window.alert(`Deleted ${res?.deletedCount ?? 0} order(s).`)
    } catch (e) {
      window.alert(e?.message || 'Could not delete orders')
    } finally {
      setWiping(false)
    }
  }

  // Merge a server-updated order back into the list. If a status tab is active
  // and the order no longer matches it (e.g. Confirmed → Shipped), drop it from
  // the view; then silently refresh so the tab counts stay accurate.
  const reconcileOrder = (updated) => {
    setOrders((os) =>
      filter !== 'all' && updated.status !== filter
        ? os.filter((o) => o._id !== updated._id)
        : os.map((o) => (o._id === updated._id ? updated : o))
    )
    load({ silent: true })
  }

  // Any admin patch (status / payment) — reconcile with the server response
  // so auto-effects (stock deduction, COD→paid on delivery) reflect.
  const patchOrder = async (id, patch) => {
    setOrders((os) => os.map((o) => (o._id === id ? { ...o, ...patch } : o)))
    const updated = await api.patch(`/orders/${id}`, patch, { auth: true })
    reconcileOrder(updated)
  }
  const setStatus = (id, status) => patchOrder(id, { status })

  // Delhivery per-order actions (sync status / cancel waybill / open label).
  const [busy, setBusy] = useState(null) // `${id}:${action}` while a request runs
  const shipmentAction = async (id, action, path) => {
    setBusy(`${id}:${action}`)
    try {
      const res = await api.post(`/orders/${id}/${path}`, {}, { auth: true })
      if (res?._id) reconcileOrder(res)
      return res
    } catch (e) {
      window.alert(e?.message || 'Action failed')
    } finally {
      setBusy(null)
    }
  }
  const openLabel = async (id) => {
    setBusy(`${id}:label`)
    try {
      const r = await api.get(`/orders/${id}/label`, { auth: true })
      if (r?.url) window.open(r.url, '_blank', 'noopener')
    } catch (e) {
      window.alert(e?.message || 'Label not ready yet. Try Sync, then retry.')
    } finally {
      setBusy(null)
    }
  }

  // Run an order's next step. "Mark Shipped" opens the tracking form first.
  const advance = (o) => {
    const a = nextAction(o.status)
    if (!a) return
    if (a.ship) setShipFor(o)
    else setStatus(o._id, a.to)
  }

  const countFor = (s) => (s === 'all' ? (counts.all || 0) : (counts[s] || 0))
  const pages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  return (
    <div>
      <AdminHeader title="Orders" subtitle={`${counts.all || 0} orders`}>
        {(counts.all || 0) > 0 && (
          <Btn variant="danger" onClick={deleteAll} disabled={wiping}>
            <Trash2 size={16} /> {wiping ? 'Deleting…' : 'Delete all'}
          </Btn>
        )}
        <Btn onClick={() => setNewOpen(true)}><Plus size={16} /> New Order</Btn>
      </AdminHeader>
      {newOpen && <NewOrderModal onClose={() => setNewOpen(false)} onCreated={() => { setPage(1); load() }} />}
      {shipFor && <ShipModal order={shipFor} delCfg={delCfg} srCfg={srCfg} onClose={() => setShipFor(null)} onShipped={(u) => { reconcileOrder(u); setShipFor(null) }} />}

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order no., name or phone…"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--gold)_28%,transparent)]"
        />
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUSES.map((s) => {
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
      ) : orders.length === 0 ? (
        <p className="text-center py-20 text-stone-400">{q ? 'No matching orders.' : (counts.all === 0 ? 'No orders yet.' : `No ${filter} orders.`)}</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const isOpen = open === o._id
            const initial = (o.customer?.name || '?').trim()[0]?.toUpperCase() || '?'
            const date = new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            return (
              <div key={o._id} className="admin-row overflow-hidden" style={{ borderLeft: `4px solid ${STATUS_SPINE[o.status] || '#3b82f6'}` }}>
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setOpen(isOpen ? null : o._id)}>
                  <div className="w-11 h-11 rounded-full grid place-items-center text-sm font-bold text-white shrink-0 hidden sm:grid" style={{ background: 'var(--maroon)' }}>{initial}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-zinc-900">{o.orderNo}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_COLOR[o.status]}`}>{o.status === 'pending' ? 'confirmed' : o.status}</span>
                      {(() => { const b = payBadge(o); return <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${b.cls}`}>{b.label}</span> })()}
                    </div>
                    <p className="text-sm text-zinc-700 truncate mt-0.5">{o.customer?.name}</p>
                    <p className="text-xs text-zinc-400">{date} · {o.items?.length} item(s)</p>
                    {o.advancePaid > 0 && o.paymentStatus !== 'paid' && (
                      <p className="text-[11px] font-semibold mt-1" style={{ color: '#7c3aed' }}>Advance {fmt(o.advancePaid)} paid · {fmt(o.total - o.advancePaid)} due on delivery</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-2">
                    <p className="font-bold text-lg leading-none" style={{ color: 'var(--maroon)' }}>{fmt(o.total)}</p>
                    {(() => {
                      const a = nextAction(o.status)
                      return a ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); advance(o) }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white cursor-pointer transition hover:brightness-110"
                          style={{ background: 'var(--maroon)' }}
                        >
                          <a.icon size={13} /> {a.label}
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-400 flex items-center gap-0.5">{isOpen ? 'Hide' : 'Details'}{isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
                      )
                    })()}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-zinc-100 bg-zinc-50/60 p-4 space-y-4">
                    {/* Progress */}
                    <div className="bg-white rounded-xl p-3 ring-1 ring-zinc-100"><Stepper status={o.status} /></div>

                    {/* Courier shipment — waybill, live status, label + actions */}
                    {o.shipment?.provider && o.shipment.provider !== 'manual' && o.shipment?.waybill && (
                      <div className="rounded-xl px-3 py-3 text-sm" style={{ background: 'color-mix(in srgb, #6366f1 9%, transparent)' }}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="font-semibold text-indigo-700 flex items-center gap-1.5"><Package size={14} /> {o.shipment.provider === 'shiprocket' ? 'Shiprocket' : 'Delhivery'}{o.shipment.courierName ? ` · ${o.shipment.courierName}` : ''} {o.shipment.mode && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold uppercase">{o.shipment.mode}</span>}</p>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-indigo-700 font-bold">{o.shipment.status || 'Booked'}</span>
                        </div>
                        <p className="text-zinc-600 mt-1.5">AWB <a href={o.shipment.trackingUrl || trackUrl(o.shipment.waybill)} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold text-indigo-700 hover:underline">{o.shipment.waybill}</a>
                          {o.shipment.codAmount > 0 && <> · collect <b>{fmt(o.shipment.codAmount)}</b></>}
                          {o.shipment.weightGrams > 0 && <span className="text-zinc-400"> · {o.shipment.weightGrams} g</span>}
                        </p>
                        {o.shipment.statusDetail && <p className="text-xs text-zinc-500 mt-0.5">{o.shipment.statusDetail}</p>}
                        <div className="flex items-center gap-2 flex-wrap mt-2.5">
                          <a href={o.shipment.trackingUrl || trackUrl(o.shipment.waybill)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-indigo-700 text-xs font-semibold ring-1 ring-indigo-100 hover:bg-indigo-50 cursor-pointer"><ExternalLink size={12} /> Track</a>
                          <button onClick={() => openLabel(o._id)} disabled={busy === `${o._id}:label`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-indigo-700 text-xs font-semibold ring-1 ring-indigo-100 hover:bg-indigo-50 cursor-pointer disabled:opacity-50"><FileText size={12} /> Label</button>
                          <button onClick={() => shipmentAction(o._id, 'sync', 'sync-shipment')} disabled={busy === `${o._id}:sync`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-zinc-600 text-xs font-semibold ring-1 ring-zinc-200 hover:bg-zinc-50 cursor-pointer disabled:opacity-50"><RefreshCw size={12} className={busy === `${o._id}:sync` ? 'animate-spin' : ''} /> Sync</button>
                          {o.shipment.status !== 'Cancelled' && o.status !== 'delivered' && (
                            <button onClick={() => { if (window.confirm(`Cancel Delhivery waybill ${o.shipment.waybill}? The order status won't change.`)) shipmentAction(o._id, 'cancel', 'cancel-shipment') }} disabled={busy === `${o._id}:cancel`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-red-600 text-xs font-semibold ring-1 ring-red-100 hover:bg-red-50 cursor-pointer disabled:opacity-50"><XCircle size={12} /> Cancel AWB</button>
                          )}
                          {o.shipment.lastSyncedAt && <span className="text-[11px] text-zinc-400">Synced {new Date(o.shipment.lastSyncedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                      </div>
                    )}

                    {/* Tracking message when shipped (manual courier note) */}
                    {(o.status === 'shipped' || o.status === 'delivered') && o.tracking?.message && (!o.shipment?.provider || o.shipment.provider === 'manual') && (
                      <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: 'color-mix(in srgb, #8b5cf6 8%, transparent)' }}>
                        <p className="font-semibold text-violet-700 flex items-center gap-1.5"><Truck size={14} /> Tracking</p>
                        <p className="text-zinc-600 mt-0.5 whitespace-pre-wrap break-words">{o.tracking.message}</p>
                        <button onClick={() => setShipFor(o)} className="block mt-1.5 text-xs text-zinc-500 underline cursor-pointer">Edit message</button>
                      </div>
                    )}

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
                          <p className="text-zinc-500 mt-2">{[o.address.line1, o.address.line2, o.address.landmark && `Near ${o.address.landmark}`, o.address.city, o.address.state, o.address.pincode].filter(Boolean).join(', ')}</p>
                        )}
                        {o.notes && <p className="text-zinc-500 mt-2 italic">“{o.notes}”</p>}
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5 font-bold">Payment</p>
                        {o.advancePaid > 0 && (
                          <p className="text-xs text-zinc-600 mb-2">Advance <b>{fmt(o.advancePaid)}</b> paid online · balance <b>{fmt(o.total - o.advancePaid)}</b> due on delivery</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Dropdown value={o.paymentMethod || 'cod'} onChange={(v) => patchOrder(o._id, { paymentMethod: v })} align="left" options={PAY_METHODS} />
                          <button
                            onClick={() => patchOrder(o._id, { paymentStatus: o.paymentStatus === 'paid' ? 'unpaid' : 'paid' })}
                            className={`px-3.5 py-2 rounded-full text-xs font-bold cursor-pointer transition ${o.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                          >
                            {o.paymentStatus === 'paid' ? <><Check size={13} className="inline -mt-0.5" /> Paid</> : 'Mark paid'}
                          </button>
                        </div>

                        {/* Edge-case status override */}
                        <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5 font-bold mt-4">Change stage</p>
                        <Dropdown value={o.status === 'pending' ? 'confirmed' : o.status} onChange={(v) => setStatus(o._id, v)} align="left" options={STATUSES.map((s) => ({ value: s, label: s }))} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && pages > 1 && (
        <div className="flex items-center justify-between mt-5 text-sm">
          <span className="text-zinc-400">Page {page} of {pages} · {total} orders</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="w-9 h-9 grid place-items-center rounded-lg border border-zinc-300 bg-white disabled:opacity-40 cursor-pointer"><ChevronLeft size={16} /></button>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="w-9 h-9 grid place-items-center rounded-lg border border-zinc-300 bg-white disabled:opacity-40 cursor-pointer"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

// Ship an order. When a courier (Delhivery / Shiprocket) is configured, book a
// waybill via its API (auto-fills the customer tracking message); otherwise (or
// by choice) paste a manual tracking note the customer will see.
function ShipModal({ order, delCfg, srCfg, onClose, onShipped }) {
  const alreadyShipped = order.status === 'shipped' || order.status === 'delivered'
  const mode = paymentMode(order)
  const totalQty = (order.items || []).reduce((a, i) => a + (i.qty || 0), 0) || 1
  const pin = order.address?.pincode

  // Tabs = every enabled courier (even if setup is incomplete — we tell the
  // admin what's missing rather than hiding it) + a Manual note fallback.
  const tabs = []
  if (!alreadyShipped && delCfg?.enabled) tabs.push({ v: 'delhivery', label: 'Delhivery', Icon: Package })
  if (!alreadyShipped && srCfg?.enabled) tabs.push({ v: 'shiprocket', label: 'Shiprocket', Icon: Package })
  tabs.push({ v: 'manual', label: 'Manual note', Icon: Truck })

  // Default: first courier whose policy auto-routes this order + is ready, else
  // the first enabled+ready courier, else manual.
  const pick = () => {
    const auto = tabs.find((t) => t.v === 'delhivery' ? (delCfg?.ready && policyApplies(delCfg, order)) : t.v === 'shiprocket' ? (srCfg?.ready && policyApplies(srCfg, order)) : false)
    if (auto) return auto.v
    if (delCfg?.ready && !alreadyShipped) return 'delhivery'
    if (srCfg?.ready && !alreadyShipped) return 'shiprocket'
    return 'manual'
  }
  const [method, setMethod] = useState(pick())

  const [message, setMessage] = useState(order.tracking?.message || '')
  const [gWeight, setGWeight] = useState(String((delCfg?.defaultWeightGrams || 100) * totalQty)) // grams (Delhivery)
  const [kWeight, setKWeight] = useState(String(((srCfg?.defaultWeightKg || 0.3) * totalQty).toFixed(2))) // kg (Shiprocket)
  const [serv, setServ] = useState(null) // serviceability result (per active courier tab)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const delReady = !!delCfg?.ready
  const srReady = !!srCfg?.ready

  // Re-run serviceability when the active courier tab changes.
  useEffect(() => {
    setServ(null)
    if (!pin) return
    let live = true
    if (method === 'delhivery' && delReady) {
      api.get(`/orders/delhivery/serviceability?pin=${encodeURIComponent(pin)}`, { auth: true })
        .then((r) => { if (live) setServ({ ok: true, ...r }) })
        .catch((e) => { if (live) setServ({ ok: false, error: e.message }) })
    } else if (method === 'shiprocket' && srReady) {
      api.get(`/orders/shiprocket/serviceability?pin=${encodeURIComponent(pin)}&weight=${encodeURIComponent(kWeight || 0.5)}&cod=${mode === 'COD'}`, { auth: true })
        .then((r) => { if (live) setServ({ ok: true, ...r }) })
        .catch((e) => { if (live) setServ({ ok: false, error: e.message }) })
    }
    return () => { live = false }
  }, [method, pin]) // eslint-disable-line

  const submitManual = async () => {
    setSaving(true); setErr('')
    try {
      const patch = { tracking: { message: message.trim() } }
      if (!alreadyShipped) patch.status = 'shipped'
      const updated = await api.patch(`/orders/${order._id}`, patch, { auth: true })
      onShipped(updated)
    } catch (e) { setErr(e.message || 'Could not save'); setSaving(false) }
  }

  const submitCourier = async (provider) => {
    setSaving(true); setErr('')
    try {
      const path = provider === 'shiprocket' ? 'ship-shiprocket' : 'ship-delhivery'
      const w = provider === 'shiprocket' ? Number(kWeight) : Number(gWeight)
      const body = w > 0 ? { weight: w } : {}
      const updated = await api.post(`/orders/${order._id}/${path}`, body, { auth: true })
      onShipped(updated)
    } catch (e) { setErr(e.message || 'Could not book this shipment'); setSaving(false) }
  }

  const activeReady = method === 'delhivery' ? delReady : method === 'shiprocket' ? srReady : true
  const missingMsg = method === 'delhivery'
    ? [!delCfg?.hasToken && 'API token', !delCfg?.hasPickup && 'pickup warehouse name'].filter(Boolean).join(' & ')
    : [!srCfg?.hasCreds && 'email + API password', !srCfg?.hasPickup && 'pickup location'].filter(Boolean).join(' & ')

  return (
    <Modal open onClose={onClose} title={alreadyShipped ? 'Edit tracking' : `Ship ${order.orderNo}`} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      {method === 'manual'
        ? <Btn onClick={submitManual} disabled={saving}><Truck size={15} /> {saving ? 'Saving…' : (alreadyShipped ? 'Save message' : 'Mark Shipped')}</Btn>
        : <Btn onClick={() => submitCourier(method)} disabled={saving || !activeReady}><Package size={15} /> {saving ? 'Booking…' : `Book ${method === 'shiprocket' ? 'Shiprocket' : 'Delhivery'} & Ship`}</Btn>}
    </>}>
      {tabs.length > 1 && (
        <div className="flex gap-2 mb-3">
          {tabs.map(({ v, label, Icon }) => (
            <button key={v} onClick={() => { setMethod(v); setErr('') }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer transition border ${method === v ? 'text-white border-transparent' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}
              style={method === v ? { background: 'var(--maroon)' } : undefined}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      )}

      {method === 'manual' ? (
        <>
          <p className="text-sm text-zinc-500 -mt-1 mb-1">Paste the delivery partner's tracking message (id + link). It's shown on the customer's order tracker exactly as typed.</p>
          <Field field={{ label: 'Tracking message', type: 'textarea', placeholder: 'e.g. Shipped via Delhivery. Tracking: 1234567890 — https://delhivery.com/track/1234567890' }} value={message} onChange={setMessage} />
        </>
      ) : (
        <div className="space-y-3">
          {!activeReady && (
            <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)' }}>
              <p className="font-semibold text-amber-700">Finish {method === 'shiprocket' ? 'Shiprocket' : 'Delhivery'} setup first</p>
              <p className="text-amber-700/90 text-xs mt-0.5">
                Missing {missingMsg}. Go to <b>Settings → Payments &amp; Shipping → {method === 'shiprocket' ? 'Shiprocket' : 'Delhivery'}</b>, fill them in, and hit <b>Save Changes</b>.
              </p>
            </div>
          )}
          <p className="text-sm text-zinc-500 -mt-1">Books a {method === 'shiprocket' ? 'Shiprocket' : 'Delhivery'} waybill for this order as <b>{mode}</b>{mode === 'COD' && <> (collect <b>{fmt(Math.max(0, (order.total || 0) - (order.advancePaid || 0)))}</b> on delivery)</>}. The customer’s tracking link is filled in automatically.</p>

          {/* Serviceability */}
          <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: 'color-mix(in srgb, #6366f1 8%, transparent)' }}>
            <p className="font-semibold text-indigo-700">Delivery to PIN {pin || '—'}</p>
            {!pin ? <p className="text-red-600 text-xs mt-0.5">No PIN on this order — add one before booking.</p>
              : !activeReady ? <p className="text-zinc-400 text-xs mt-0.5">Finish setup to check serviceability.</p>
              : !serv ? <p className="text-zinc-500 text-xs mt-0.5">Checking serviceability…</p>
              : !serv.ok ? <p className="text-amber-600 text-xs mt-0.5">Couldn’t verify ({serv.error}). You can still try to book.</p>
              : !serv.serviceable ? <p className="text-red-600 text-xs mt-0.5">Not serviceable by {method === 'shiprocket' ? 'Shiprocket' : 'Delhivery'}. Try the other courier or ship manually.</p>
              : method === 'shiprocket'
                ? <p className="text-emerald-700 text-xs mt-0.5">Serviceable · {serv.couriers?.length || 0} courier(s){serv.cheapest ? ` · from ₹${Math.round(serv.cheapest.rate || 0)} (${serv.cheapest.name})` : ''}. Shiprocket picks the recommended one.</p>
                : <p className="text-emerald-700 text-xs mt-0.5">Serviceable{serv.city ? ` · ${serv.city}, ${serv.state}` : ''} · COD {serv.cod ? '✓' : '✗'} · Prepaid {serv.prepaid ? '✓' : '✗'}{mode === 'COD' && !serv.cod ? ' — COD not available here!' : ''}</p>}
          </div>

          {method === 'shiprocket'
            ? <Field field={{ label: 'Package weight (kg)', type: 'number', help: `Default ${srCfg?.defaultWeightKg || 0.3} kg × ${totalQty} item(s). Adjust if needed.` }} value={kWeight} onChange={setKWeight} />
            : <Field field={{ label: 'Package weight (grams)', type: 'number', help: `Default ${delCfg?.defaultWeightGrams || 100} g × ${totalQty} item(s). Adjust if needed.` }} value={gWeight} onChange={setGWeight} />}
        </div>
      )}
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
    </Modal>
  )
}

// Manually log an order with real line items + payment.
function NewOrderModal({ onClose, onCreated }) {
  const [products, setProducts] = useState([])
  const [lines, setLines] = useState([])
  const [cust, setCust] = useState({ name: '', phone: '', email: '' })
  const [addr, setAddr] = useState({ line1: '', city: '', pincode: '' })
  const [status, setStatus] = useState('confirmed')
  const [method, setMethod] = useState('cod')
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
