import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Phone, Plus, Minus, Trash2, Check, Search, Truck, PackageCheck, ExternalLink, RefreshCw, XCircle, FileText, Package, MapPin, X, Inbox, MessageCircle, Mail, Copy } from 'lucide-react'
import { api } from '../../lib/api.js'
import { Btn, Modal, Field } from '../../components/admin/AdminUI.jsx'
import { Dropdown } from '../../components/ui/Dropdown.jsx'

const PAGE_LIMIT = 20

const fmtN = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const PAY_METHODS = [
  { value: 'cod', label: 'Cash on delivery' }, { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' }, { value: 'bank', label: 'Bank transfer' },
  { value: 'razorpay', label: 'Razorpay (online)' },
]
// Compact labels for the drawer's method chips.
const PAY_SHORT = { cod: 'COD', cash: 'Cash', upi: 'UPI', bank: 'Bank', razorpay: 'Razorpay' }

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
// 'pending' kept for legacy orders only; new orders start Confirmed.
const STATUSES = ['confirmed', 'shipped', 'delivered', 'cancelled']

// The order pipeline — each stage is a tappable stat card that IS the filter.
// `archive` stages (done/dead orders) render as quiet compact pills so the
// owner's eye stays on live work (To Ship / In Transit).
const PIPELINE = [
  { key: 'confirmed', label: 'To Ship',    icon: Package,     color: '#2563eb' },
  { key: 'shipped',   label: 'In Transit', icon: Truck,       color: '#7c3aed' },
  { key: 'delivered', label: 'Delivered',  icon: PackageCheck, color: '#059669', archive: true },
  { key: 'cancelled', label: 'Cancelled',  icon: XCircle,     color: '#dc2626', archive: true },
]
const STATUS = {
  pending:   { label: 'Confirmed', color: '#2563eb' },
  confirmed: { label: 'Confirmed', color: '#2563eb' },
  shipped:   { label: 'Shipped',   color: '#7c3aed' },
  delivered: { label: 'Delivered', color: '#059669' },
  cancelled: { label: 'Cancelled', color: '#dc2626' },
}
const st = (s) => STATUS[s] || STATUS.confirmed

// The single next-step action for an order (drives the primary button).
function nextAction(status) {
  if (status === 'pending' || status === 'confirmed') return { label: 'Mark Shipped', to: 'shipped', ship: true, icon: Truck }
  if (status === 'shipped') return { label: 'Mark Delivered', to: 'delivered', icon: PackageCheck }
  return null
}

// Clean horizontal stepper for the order detail.
const STAGES = [{ key: 'confirmed', label: 'Confirmed' }, { key: 'shipped', label: 'Shipped' }, { key: 'delivered', label: 'Delivered' }]
function Stepper({ status }) {
  if (status === 'cancelled') return (
    <div className="inline-flex items-center gap-2 text-sm font-bold text-red-600"><XCircle size={16} /> Order cancelled</div>
  )
  const idx = Math.max(0, STAGES.findIndex((s) => s.key === status))
  return (
    <div className="flex items-center">
      {STAGES.map((s, i) => {
        const done = i <= idx
        const current = i === idx
        const isLast = i === STAGES.length - 1
        return (
          <div key={s.key} className="flex items-center" style={{ flex: isLast ? '0 0 auto' : 1 }}>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full grid place-items-center shrink-0 transition-all"
                style={{
                  background: done ? 'var(--maroon)' : '#fff',
                  color: '#fff',
                  boxShadow: current
                    ? '0 0 0 4px color-mix(in srgb, var(--maroon) 16%, transparent)'
                    : done ? 'none' : 'inset 0 0 0 2px #e4e4e7',
                }}
              >
                {done ? <Check size={13} strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d4d4d8' }} />}
              </div>
              <span className="text-xs font-semibold" style={{ color: done ? 'var(--ink)' : '#a1a1aa' }}>{s.label}</span>
            </div>
            {!isLast && <div className="h-[3px] flex-1 mx-2.5 rounded-full" style={{ background: i < idx ? 'var(--maroon)' : '#ececee' }} />}
          </div>
        )
      })}
    </div>
  )
}

// Prepaid vs COD for an order (mirrors the server's orderPaymentMode).
const paymentMode = (o) => (o.paymentStatus === 'paid' || !['cod', 'cash'].includes(o.paymentMethod) ? 'Prepaid' : 'COD')
const trackUrl = (wb) => `https://shiprocket.co/tracking/${encodeURIComponent(wb)}`

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
  const [drawer, setDrawer] = useState(null) // full order object shown in the slide-over
  const [filter, setFilter] = useState('confirmed')
  const [payFilter, setPayFilter] = useState('') // '' | 'paid' | 'cod' — sub-filter within a status
  const [payCounts, setPayCounts] = useState({ all: 0, paid: 0, cod: 0 })
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [shipFor, setShipFor] = useState(null) // order being marked shipped (tracking form)
  const [selected, setSelected] = useState([])  // order ids picked for bulk shipping (To Ship tab)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [srCfg, setSrCfg] = useState(null)     // Shiprocket config (enabled/policy/ready)

  // Courier config drives the ship flow (auto-book vs manual). Read from the
  // admin settings endpoint (the tokens/passwords stay server-side).
  useEffect(() => {
    api.get('/settings/admin', { auth: true })
      .then((s) => {
        const r = s?.shiprocket || {}
        setSrCfg({
          enabled: !!r.enabled,
          policy: r.policy || 'manual',
          hasCreds: !!(r.email && r.password),
          hasPickup: !!r.pickupLocation,
          hasPin: !!r.pickupPin,
          ready: !!(r.enabled && r.email && r.password && r.pickupLocation),
          defaultWeightKg: Number(r.defaultWeightKg) || 0.3,
          routing: s?.shippingRouting || r.policy || 'manual',
        })
      })
      .catch(() => setSrCfg({ enabled: false, ready: false }))
  }, [])

  // Debounced search; reset to page 1 on new query/filter.
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1) }, 350); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1); setPayFilter('') }, [filter]) // status change → back to page 1, clear the payment sub-filter
  useEffect(() => { setPage(1) }, [payFilter])
  useEffect(() => { setSelected([]) }, [filter, payFilter, q, page])

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    const statusParam = filter === 'all' ? '' : filter
    const res = await api.get(`/orders?status=${statusParam}&payment=${payFilter}&search=${encodeURIComponent(q)}&page=${page}&limit=${PAGE_LIMIT}`, { auth: true })
    setOrders(res.items || [])
    setCounts(res.counts || { all: 0 })
    setPayCounts(res.paymentCounts || { all: 0, paid: 0, cod: 0 })
    setTotal(res.total || 0)
    setLoading(false)
  }
  useEffect(() => { load() }, [filter, payFilter, q, page]) // eslint-disable-line

  // Merge a server-updated order back into the list (and the open drawer). If a
  // status tab is active and the order no longer matches it (e.g. Confirmed →
  // Shipped), drop it from the view; then silently refresh so counts stay right.
  const reconcileOrder = (updated) => {
    setOrders((os) =>
      filter !== 'all' && updated.status !== filter
        ? os.filter((o) => o._id !== updated._id)
        : os.map((o) => (o._id === updated._id ? updated : o))
    )
    setDrawer((d) => (d && d._id === updated._id ? updated : d))
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

  // Courier per-order actions (sync status / cancel waybill / open label).
  const [busy, setBusy] = useState(null) // `${id}:${action}` while a request runs
  const shipmentAction = async (id, action, path, body = {}) => {
    setBusy(`${id}:${action}`)
    try {
      const res = await api.post(`/orders/${id}/${path}`, body, { auth: true })
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
  const toShip = counts.confirmed || 0

  return (
    <div>
      {/* ── Header — button sits beside the title, never on its own row ── */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-[28px] font-extrabold tracking-tight text-zinc-900">Orders</h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            {toShip > 0
              ? <><b className="text-zinc-800">{toShip} order{toShip === 1 ? '' : 's'}</b> waiting to ship</>
              : 'Nothing waiting to ship'}
            <span className="text-zinc-300 mx-1.5">·</span>{counts.all || 0} total
          </p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          aria-label="New order"
          title="New order"
          className="w-10 h-10 grid place-items-center rounded-xl text-white shadow-sm cursor-pointer transition-all hover:brightness-110 active:scale-95 shrink-0"
          style={{ background: 'var(--maroon)' }}
        >
          <Plus size={19} strokeWidth={2.5} />
        </button>
      </div>
      {newOpen && <NewOrderModal onClose={() => setNewOpen(false)} onCreated={() => { setPage(1); load() }} />}
      {shipFor && <ShipModal order={shipFor} srCfg={srCfg} onClose={() => setShipFor(null)} onShipped={(u) => { reconcileOrder(u); setShipFor(null) }} />}

      {/* ── Pipeline — live work gets the big cards; Delivered/Cancelled are
             quiet archive pills so they never pull focus ─────── */}
      <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 mb-5">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 flex-1">
          {PIPELINE.filter((p) => !p.archive).map(({ key, label, icon: Icon, color }) => {
            const active = filter === key
            const n = countFor(key)
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`text-left rounded-2xl p-3.5 sm:p-4 cursor-pointer transition-all ${active ? 'bg-white shadow-[0_10px_28px_-14px_rgba(0,0,0,0.25)]' : 'bg-white/60 ring-1 ring-zinc-200/60 hover:bg-white hover:shadow-[0_4px_16px_-10px_rgba(0,0,0,0.2)]'}`}
                style={active ? { boxShadow: `0 10px 28px -14px rgba(0,0,0,0.25), inset 0 0 0 2px ${color}` } : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `color-mix(in srgb, ${color} ${active ? 15 : 9}%, white)`, color }}>
                    <Icon size={17} />
                  </div>
                  <span className="text-[22px] sm:text-2xl font-extrabold leading-none text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                </div>
                <p className="text-[12px] font-bold mt-2.5" style={{ color: active ? color : '#71717a' }}>{label}</p>
              </button>
            )
          })}
        </div>

        {/* Archive — greyscale until selected */}
        <div className="flex lg:flex-col gap-2 lg:w-44 lg:justify-center">
          {PIPELINE.filter((p) => p.archive).map(({ key, label, icon: Icon, color }) => {
            const active = filter === key
            const n = countFor(key)
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="flex-1 lg:flex-none flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-left cursor-pointer transition-all"
                style={active
                  ? { background: '#fff', boxShadow: `0 10px 28px -14px rgba(0,0,0,0.25), inset 0 0 0 2px ${color}` }
                  : { background: 'rgba(255,255,255,0.45)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }}
              >
                <Icon size={15} style={{ color: active ? color : '#b6b6bd' }} />
                <span className="text-[12px] font-bold flex-1" style={{ color: active ? color : '#a1a1aa' }}>{label}</span>
                <span className="text-[13px] font-extrabold" style={{ fontVariantNumeric: 'tabular-nums', color: active ? color : '#b6b6bd' }}>{n}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Toolbar: search + payment split ─────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, name or phone…"
            className="w-full pr-3 py-2.5 rounded-xl ring-1 ring-zinc-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--gold)_55%,transparent)] transition"
            style={{ paddingLeft: 38 }}
          />
        </div>
        {filter === 'confirmed' && (
          <div className="inline-flex p-1 rounded-xl bg-zinc-200/60">
            {[
              { v: '', label: 'All', n: payCounts.all },
              { v: 'cod', label: 'COD', n: payCounts.cod },
              { v: 'paid', label: 'Paid online', n: payCounts.paid },
            ].map(({ v, label, n }) => {
              const on = payFilter === v
              return (
                <button
                  key={v || 'all'}
                  onClick={() => setPayFilter(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${on ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  {label} <span className="font-semibold text-zinc-400">({n})</span>
                </button>
              )
            })}
          </div>
        )}
        {!loading && <span className="ml-auto hidden sm:block text-[12px] font-medium text-zinc-400">{total} result{total === 1 ? '' : 's'}</span>}
      </div>

      {/* ── List ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-2xl bg-white ring-1 ring-zinc-200/70 overflow-hidden divide-y divide-zinc-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
              <div className="w-11 h-11 rounded-xl bg-zinc-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 bg-zinc-100 rounded-md" />
                <div className="h-3 w-56 bg-zinc-100 rounded-md" />
              </div>
              <div className="h-4 w-16 bg-zinc-100 rounded-md" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-zinc-200/70 py-16 flex flex-col items-center text-center px-6">
          <div className="w-14 h-14 rounded-2xl grid place-items-center mb-3.5" style={{ background: 'color-mix(in srgb, var(--gold) 14%, white)' }}>
            <Inbox size={24} style={{ color: 'var(--gold)' }} />
          </div>
          <p className="font-bold text-[15px] text-zinc-800">
            {q ? 'No matching orders' : counts.all === 0 ? 'No orders yet' : `Nothing in ${PIPELINE.find((p) => p.key === filter)?.label || filter}`}
          </p>
          <p className="text-[13px] text-zinc-400 mt-1 max-w-xs">
            {q ? 'Try a different order number, name or phone.' : counts.all === 0 ? 'New orders from the store will land here.' : 'Orders move here as their status changes.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white ring-1 ring-zinc-200/70 overflow-hidden divide-y divide-zinc-100">
          {orders.map((o) => {
            const pb = payBadge(o)
            const a = nextAction(o.status)
            const firstImg = (o.items || []).find((it) => it.image)?.image
            const initial = (o.customer?.name || '?').trim()[0]?.toUpperCase() || '?'
            const date = new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            const canBulk = filter === 'confirmed' && srCfg?.enabled && !o.shipment?.waybill
            const isSel = selected.includes(o._id)
            return (
              <div
                key={o._id}
                onClick={() => setDrawer(o)}
                className={`group flex items-center gap-3 sm:gap-4 px-3.5 sm:px-5 py-3.5 cursor-pointer transition-colors ${isSel ? 'bg-[color-mix(in_srgb,var(--gold)_9%,white)]' : 'hover:bg-[color-mix(in_srgb,var(--gold)_5%,white)]'}`}
              >
                {canBulk && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelected((xs) => (xs.includes(o._id) ? xs.filter((x) => x !== o._id) : [...xs, o._id])) }}
                    aria-label={isSel ? 'Deselect order' : 'Select order'}
                    className="w-5 h-5 rounded-md grid place-items-center shrink-0 cursor-pointer transition-colors"
                    style={isSel ? { background: 'var(--maroon)', color: '#fff' } : { background: '#fff', boxShadow: 'inset 0 0 0 1.5px #d4d4d8' }}
                  >
                    {isSel && <Check size={13} strokeWidth={3} />}
                  </button>
                )}
                {firstImg ? (
                  <img src={firstImg} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 ring-1 ring-black/5" />
                ) : (
                  <div className="w-11 h-11 rounded-xl grid place-items-center text-[15px] font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, var(--maroon), var(--maroon-dark, #5a121c))' }}>{initial}</div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[14px] text-zinc-900 tracking-tight">{o.orderNo}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide ${pb.cls}`}>{pb.label}</span>
                    {o.shipment?.waybill && o.shipment.provider !== 'manual' && (
                      <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide bg-indigo-50 text-indigo-600">Shiprocket</span>
                    )}
                  </div>
                  <p className="text-[13px] text-zinc-500 truncate mt-0.5">
                    {o.customer?.name}
                    <span className="text-zinc-300 mx-1">·</span>{date}
                    <span className="text-zinc-300 mx-1">·</span>{o.items?.length} item{o.items?.length === 1 ? '' : 's'}
                  </p>
                  {o.advancePaid > 0 && o.paymentStatus !== 'paid' && (
                    <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#7c3aed' }}>Advance {fmt(o.advancePaid)} · {fmt(o.total - o.advancePaid)} due</p>
                  )}
                </div>

                <span className="font-extrabold text-[15px] shrink-0" style={{ color: 'var(--maroon)', fontVariantNumeric: 'tabular-nums' }}>{fmt(o.total)}</span>

                {a && (
                  <button
                    onClick={(e) => { e.stopPropagation(); advance(o) }}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-colors bg-white ring-1 ring-zinc-200 text-[var(--maroon)] hover:bg-[var(--maroon)] hover:text-white hover:ring-[var(--maroon)]"
                  >
                    <a.icon size={14} /><span className="hidden sm:inline">{a.label}</span>
                  </button>
                )}

                <ChevronRight size={16} className="shrink-0 text-zinc-300 group-hover:text-zinc-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────── */}
      {!loading && pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-5">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="w-9 h-9 grid place-items-center rounded-xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-300 disabled:opacity-40 cursor-pointer transition"><ChevronLeft size={16} /></button>
          <span className="text-[13px] font-bold text-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{page} <span className="text-zinc-300 font-medium">/</span> {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="w-9 h-9 grid place-items-center rounded-xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-300 disabled:opacity-40 cursor-pointer transition"><ChevronRight size={16} /></button>
        </div>
      )}

      {/* ── Bulk ship bar — floats while orders are selected ── */}
      {selected.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 sm:gap-3 bg-white rounded-2xl shadow-[0_14px_44px_-10px_rgba(0,0,0,0.35)] ring-1 ring-zinc-200 pl-4 pr-2 py-2 max-w-[calc(100vw-24px)]">
          <span className="text-[13px] font-bold text-zinc-800 whitespace-nowrap">{selected.length} selected</span>
          <button onClick={() => setSelected(orders.filter((o) => !o.shipment?.waybill).map((o) => o._id))} className="text-[12px] font-semibold text-zinc-400 hover:text-zinc-600 cursor-pointer whitespace-nowrap">All on page</button>
          <button onClick={() => setSelected([])} className="text-[12px] font-semibold text-zinc-400 hover:text-zinc-600 cursor-pointer">Clear</button>
          <button
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold text-white cursor-pointer transition-all hover:brightness-110 active:scale-[0.98] whitespace-nowrap"
            style={{ background: 'var(--maroon)' }}
          >
            <Package size={14} /> Book {selected.length} via Shiprocket
          </button>
        </div>
      )}
      {bulkOpen && (
        <BulkShipSheet
          orders={orders.filter((o) => selected.includes(o._id))}
          srCfg={srCfg}
          onClose={() => setBulkOpen(false)}
          onDone={() => { setBulkOpen(false); setSelected([]); load() }}
        />
      )}

      {/* ── Detail drawer ───────────────────────────────────── */}
      {drawer && (
        <OrderDrawer
          o={drawer}
          busy={busy}
          onClose={() => setDrawer(null)}
          onAdvance={advance}
          onPatch={patchOrder}
          onSetStatus={setStatus}
          onShipEdit={setShipFor}
          onShipmentAction={shipmentAction}
          onOpenLabel={openLabel}
        />
      )}
    </div>
  )
}

// Slide-over panel with the complete order: progress, courier shipment,
// items + money breakdown, customer, payment. All actions live here.
function OrderDrawer({ o, busy, onClose, onAdvance, onPatch, onSetStatus, onShipEdit, onShipmentAction, onOpenLabel }) {
  const [show, setShow] = useState(false)
  const [preview, setPreview] = useState(null) // item image opened full-screen
  const [moreMethods, setMoreMethods] = useState(false) // reveal Cash/UPI/Bank chips
  const [copied, setCopied] = useState(false) // address copied feedback
  const [cancelOpen, setCancelOpen] = useState(false) // cancel-with-reason sheet

  // Copy name + phone + full address — exactly what a courier form wants.
  const copyAddress = () => {
    const text = [
      o.customer?.name,
      o.customer?.phone,
      o.address?.line1,
      o.address?.line2,
      o.address?.landmark && `Near ${o.address.landmark}`,
      [o.address?.city, o.address?.state, o.address?.pincode].filter(Boolean).join(', '),
    ].filter(Boolean).join('\n')
    navigator.clipboard?.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
      .catch(() => {})
  }
  const close = () => { setShow(false); setTimeout(onClose, 200) }

  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true))
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
    }
  }, [])

  // Esc closes the topmost layer only: ship sheet (handles itself) → image
  // preview → then the drawer.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      // A sheet stacked above the drawer handles its own Esc.
      if (document.getElementById('ship-modal-root') || document.getElementById('cancel-sheet-root')) return
      if (preview) setPreview(null)
      else close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview]) // eslint-disable-line

  const s = st(o.status)
  const pb = payBadge(o)
  const a = nextAction(o.status)
  const sh = o.shipment
  const date = new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="fixed inset-0 z-50">
      <div className={`absolute inset-0 bg-zinc-900/40 transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`} onClick={close} />
      <div className={`absolute right-0 top-0 h-full w-full sm:w-[460px] bg-zinc-50 shadow-2xl flex flex-col transition-transform duration-200 ease-out ${show ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Drawer header */}
        <div className="bg-white px-4 sm:px-5 pt-4 pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-[17px] text-zinc-900 tracking-tight">{o.orderNo}</span>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide" style={{ background: `color-mix(in srgb, ${s.color} 11%, white)`, color: s.color, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${s.color} 22%, transparent)` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{s.label}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${pb.cls}`}>{pb.label}</span>
              </div>
              <p className="text-[13px] text-zinc-400 mt-1">{date} · {o.items?.length} item{o.items?.length === 1 ? '' : 's'}</p>
            </div>
            <button onClick={close} className="w-9 h-9 grid place-items-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer transition shrink-0" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="flex items-end justify-between gap-3 mt-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Total</p>
              <p className="text-[26px] font-extrabold leading-tight" style={{ color: 'var(--maroon)', fontVariantNumeric: 'tabular-nums' }}>{fmt(o.total)}</p>
              {o.advancePaid > 0 && o.paymentStatus !== 'paid' && (
                <p className="text-[11px] font-semibold" style={{ color: '#7c3aed' }}>Advance {fmt(o.advancePaid)} paid · {fmt(o.total - o.advancePaid)} due</p>
              )}
            </div>
            {a && (
              <button
                onClick={() => onAdvance(o)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white cursor-pointer transition-all hover:brightness-110 active:scale-[0.98] shadow-sm shrink-0"
                style={{ background: 'var(--maroon)' }}
              >
                <a.icon size={15} /> {a.label}
              </button>
            )}
          </div>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Progress */}
          <div className="bg-white rounded-2xl p-4 ring-1 ring-zinc-100"><Stepper status={o.status} /></div>

          {/* Courier shipment — waybill, live status, label + actions */}
          {sh?.provider && sh.provider !== 'manual' && sh?.waybill && (
            <div className="rounded-2xl px-4 py-3.5 text-sm" style={{ background: 'color-mix(in srgb, #6366f1 9%, white)' }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-semibold text-indigo-700 flex items-center gap-1.5"><Package size={14} /> Shiprocket{sh.courierName ? ` · ${sh.courierName}` : ''} {sh.mode && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold uppercase">{sh.mode}</span>}</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-indigo-700 font-bold">{sh.status || 'Booked'}</span>
              </div>
              <p className="text-zinc-600 mt-1.5">AWB <a href={sh.trackingUrl || trackUrl(sh.waybill)} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold text-indigo-700 hover:underline">{sh.waybill}</a>
                {sh.codAmount > 0 && <> · collect <b>{fmt(sh.codAmount)}</b></>}
                {sh.weightGrams > 0 && <span className="text-zinc-400"> · {sh.weightGrams} g</span>}
              </p>
              {sh.statusDetail && <p className="text-xs text-zinc-500 mt-0.5">{sh.statusDetail}</p>}
              <div className="flex items-center gap-2 flex-wrap mt-2.5">
                <a href={sh.trackingUrl || trackUrl(sh.waybill)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-indigo-700 text-xs font-semibold ring-1 ring-indigo-100 hover:bg-indigo-50 cursor-pointer"><ExternalLink size={12} /> Track</a>
                <button onClick={() => onOpenLabel(o._id)} disabled={busy === `${o._id}:label`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-indigo-700 text-xs font-semibold ring-1 ring-indigo-100 hover:bg-indigo-50 cursor-pointer disabled:opacity-50"><FileText size={12} /> Label</button>
                <button onClick={() => onShipmentAction(o._id, 'sync', 'sync-shipment')} disabled={busy === `${o._id}:sync`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-zinc-600 text-xs font-semibold ring-1 ring-zinc-200 hover:bg-zinc-50 cursor-pointer disabled:opacity-50"><RefreshCw size={12} className={busy === `${o._id}:sync` ? 'animate-spin' : ''} /> Sync</button>
                {sh.status !== 'Cancelled' && o.status !== 'delivered' && (
                  <button onClick={() => { if (window.confirm(`Cancel AWB ${sh.waybill}?\n\nThis cancels the shipment with the courier and moves the order back to Confirmed (clearing the tracking) so you can re-book. Freight is refunded to your courier wallet if it hasn't been picked up.`)) onShipmentAction(o._id, 'cancel', 'cancel-shipment', { revert: true }) }} disabled={busy === `${o._id}:cancel`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-red-600 text-xs font-semibold ring-1 ring-red-100 hover:bg-red-50 cursor-pointer disabled:opacity-50"><XCircle size={12} /> Cancel &amp; reset</button>
                )}
              </div>
              {sh.lastSyncedAt && <p className="text-[11px] text-zinc-400 mt-2">Synced {new Date(sh.lastSyncedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
            </div>
          )}

          {/* Tracking message when shipped (manual courier note) */}
          {(o.status === 'shipped' || o.status === 'delivered') && o.tracking?.message && (!sh?.provider || sh.provider === 'manual') && (
            <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, #8b5cf6 8%, white)' }}>
              <p className="font-semibold text-violet-700 flex items-center gap-1.5"><Truck size={14} /> Tracking</p>
              <p className="text-zinc-600 mt-0.5 whitespace-pre-wrap break-words">{o.tracking.message}</p>
              <button onClick={() => onShipEdit(o)} className="block mt-1.5 text-xs text-zinc-500 underline cursor-pointer">Edit message</button>
            </div>
          )}

          {/* Items + money breakdown */}
          <div className="bg-white rounded-2xl ring-1 ring-zinc-100 overflow-hidden">
            <p className="px-4 pt-3 pb-2 text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Items</p>
            <div className="divide-y divide-zinc-50">
              {o.items.map((it, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <button
                    onClick={() => it.image && setPreview(it.image)}
                    disabled={!it.image}
                    className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-50 shrink-0 ring-1 ring-zinc-100 cursor-zoom-in disabled:cursor-default hover:ring-2 hover:ring-[var(--gold)] transition"
                    aria-label={it.image ? `Preview ${it.name}` : undefined}
                  >
                    {it.image && <img src={it.image} alt="" className="w-full h-full object-cover" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-zinc-800 leading-snug">{it.name}</p>
                    <p className="text-[12px] text-zinc-400 mt-0.5">{it.qty} × {fmt(it.price)}</p>
                  </div>
                  <span className="text-[14px] font-bold text-zinc-900 shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-zinc-100 space-y-1.5 text-[13px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span>{fmt(o.subtotal)}</span></div>
              {o.shipping > 0 && <div className="flex justify-between text-zinc-500"><span>Shipping</span><span>{fmt(o.shipping)}</span></div>}
              {o.codFee > 0 && <div className="flex justify-between text-zinc-500"><span>COD fee</span><span>{fmt(o.codFee)}</span></div>}
              {o.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount{o.couponCode ? ` · ${o.couponCode}` : ''}</span><span>−{fmt(o.discount)}</span></div>}
              <div className="flex justify-between items-center pt-1.5 mt-0.5 border-t border-zinc-100">
                <span className="text-[13px] font-bold text-zinc-700">Total</span>
                <span className="text-[16px] font-extrabold" style={{ color: 'var(--maroon)' }}>{fmt(o.total)}</span>
              </div>
            </div>
          </div>

          {/* Customer — identity, one-tap contact actions, copyable address */}
          <div className="bg-white rounded-2xl ring-1 ring-zinc-100 p-4">
            <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Customer</p>

            <div className="flex items-center gap-3 mt-2.5">
              <div className="w-10 h-10 rounded-xl grid place-items-center text-[15px] font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, var(--maroon), var(--maroon-dark, #5a121c))' }}>
                {(o.customer?.name || '?').trim()[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[15px] text-zinc-900 leading-snug">{o.customer?.name}</p>
                <p className="text-[12.5px] text-zinc-400" style={{ fontVariantNumeric: 'tabular-nums' }}>{o.customer?.phone}</p>
              </div>
            </div>

            {/* One-tap contact actions */}
            <div className={`grid gap-1.5 mt-3 ${o.customer?.email ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <a href={`tel:${o.customer?.phone}`} className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors cursor-pointer">
                <Phone size={16} style={{ color: 'var(--maroon)' }} />
                <span className="text-[11px] font-bold text-zinc-600">Call</span>
              </a>
              <a href={`https://wa.me/91${String(o.customer?.phone || '').replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors cursor-pointer">
                <MessageCircle size={16} className="text-emerald-600" />
                <span className="text-[11px] font-bold text-zinc-600">WhatsApp</span>
              </a>
              {o.customer?.email && (
                <a href={`mailto:${o.customer.email}`} className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors cursor-pointer">
                  <Mail size={16} className="text-zinc-500" />
                  <span className="text-[11px] font-bold text-zinc-600">Email</span>
                </a>
              )}
            </div>

            {/* Delivery address — formatted lines + one-tap copy for courier forms */}
            {(o.address?.line1 || o.address?.city) && (
              <div className="mt-3 rounded-xl bg-zinc-50 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-1"><MapPin size={11} /> Deliver to</p>
                  <button
                    onClick={copyAddress}
                    className={`inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors ${copied ? 'text-emerald-600' : 'text-zinc-400 hover:text-zinc-600'}`}
                  >
                    {copied ? <><Check size={12} strokeWidth={3} /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>
                </div>
                <p className="text-[13.5px] text-zinc-700 leading-relaxed mt-1.5">
                  {o.address.line1}
                  {o.address.line2 && <><br />{o.address.line2}</>}
                  {o.address.landmark && <><br />Near {o.address.landmark}</>}
                  <br />{[o.address.city, o.address.state].filter(Boolean).join(', ')}
                  {o.address.pincode && <> — <b className="text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{o.address.pincode}</b></>}
                </p>
              </div>
            )}

            {/* Customer note */}
            {o.notes && (
              <div className="mt-3 rounded-xl px-3.5 py-3" style={{ background: 'color-mix(in srgb, #f59e0b 9%, white)' }}>
                <p className="text-[11px] uppercase tracking-wider font-bold text-amber-600">Customer note</p>
                <p className="text-[13px] text-zinc-700 mt-1 leading-relaxed">{o.notes}</p>
              </div>
            )}
          </div>

          {/* Payment — switch row + method chips (no dropdowns) */}
          <div className="bg-white rounded-2xl ring-1 ring-zinc-100 p-4">
            <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Payment</p>

            {/* One-tap paid toggle */}
            {(() => {
              const paid = o.paymentStatus === 'paid'
              return (
                <button
                  onClick={() => onPatch(o._id, { paymentStatus: paid ? 'unpaid' : 'paid' })}
                  className="w-full mt-2.5 flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl cursor-pointer transition-colors"
                  style={{
                    background: paid ? 'color-mix(in srgb, #059669 9%, white)' : '#fafafa',
                    boxShadow: `inset 0 0 0 1px ${paid ? 'color-mix(in srgb, #059669 30%, transparent)' : '#e4e4e7'}`,
                  }}
                >
                  <span className="text-[13px] font-bold" style={{ color: paid ? '#047857' : '#71717a' }}>
                    {paid ? <><Check size={14} className="inline -mt-0.5 mr-1" strokeWidth={3} />Payment received</> : 'Payment pending'}
                  </span>
                  <span className="relative w-10 h-6 rounded-full transition-colors shrink-0" style={{ background: paid ? '#059669' : '#d4d4d8' }}>
                    <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: paid ? 18 : 2 }} />
                  </span>
                </button>
              )
            })()}

            {/* Method chips — the two real store methods up front; Cash/UPI/Bank
                (for manually logged orders) tucked behind "More" */}
            <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold mt-4 mb-2">Method</p>
            <div className="flex flex-wrap gap-1.5">
              {PAY_METHODS
                .filter((m) => moreMethods || ['cod', 'razorpay'].includes(m.value) || (o.paymentMethod || 'cod') === m.value)
                .map((m) => {
                  const on = (o.paymentMethod || 'cod') === m.value
                  return (
                    <button
                      key={m.value}
                      onClick={() => !on && onPatch(o._id, { paymentMethod: m.value })}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer transition-colors ${on ? 'text-white' : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:ring-zinc-300 hover:text-zinc-700'}`}
                      style={on ? { background: 'var(--maroon)' } : undefined}
                    >
                      {PAY_SHORT[m.value] || m.label}
                    </button>
                  )
                })}
              {!moreMethods && (
                <button
                  onClick={() => setMoreMethods(true)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-zinc-400 border border-dashed border-zinc-300 hover:text-zinc-600 hover:border-zinc-400 cursor-pointer transition-colors"
                >
                  More…
                </button>
              )}
            </div>
          </div>

          {/* Order stage — segmented selector + cancel/restore (no dropdown) */}
          <div className="bg-white rounded-2xl ring-1 ring-zinc-100 p-4">
            <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold mb-2.5">Order stage</p>
            <div className="grid grid-cols-3 gap-1.5">
              {STAGES.map(({ key, label }) => {
                const cur = (o.status === 'pending' ? 'confirmed' : o.status) === key
                const color = st(key).color
                const pick = () => {
                  if (cur) return
                  // Moving into Shipped goes through the proper ship flow (courier
                  // booking / tracking note) instead of silently flipping status.
                  if (key === 'shipped' && (o.status === 'confirmed' || o.status === 'pending')) return onShipEdit(o)
                  onSetStatus(o._id, key)
                }
                return (
                  <button
                    key={key}
                    onClick={pick}
                    className="py-2.5 rounded-xl text-[12px] font-bold text-center cursor-pointer transition-colors"
                    style={cur
                      ? { background: `color-mix(in srgb, ${color} 11%, white)`, color, boxShadow: `inset 0 0 0 1.5px ${color}` }
                      : { background: '#fff', color: o.status === 'cancelled' ? '#d4d4d8' : '#71717a', boxShadow: 'inset 0 0 0 1px #e4e4e7' }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {o.status === 'cancelled' ? (
              <>
                {o.cancelReason && (
                  <p className="mt-2.5 text-[12px] text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5 leading-relaxed"><b>Reason:</b> {o.cancelReason}</p>
                )}
                <button
                  onClick={() => onSetStatus(o._id, 'confirmed')}
                  className="w-full mt-2.5 py-2.5 rounded-xl text-[12px] font-bold cursor-pointer transition-colors text-blue-600 bg-blue-50 hover:bg-blue-100"
                >
                  Restore order to Confirmed
                </button>
              </>
            ) : (
              <button
                onClick={() => setCancelOpen(true)}
                className="w-full mt-2.5 py-2.5 rounded-xl text-[12px] font-bold cursor-pointer transition-colors text-red-500 bg-white ring-1 ring-red-100 hover:bg-red-50"
              >
                <XCircle size={13} className="inline -mt-0.5 mr-1" />Cancel order
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel with a customer-facing reason (emails the customer) */}
      {cancelOpen && (
        <CancelSheet
          o={o}
          onClose={() => setCancelOpen(false)}
          onConfirm={async (reason) => {
            await onPatch(o._id, { status: 'cancelled', cancelReason: reason })
            setCancelOpen(false)
          }}
        />
      )}

      {/* Full-screen item image preview — tap anywhere (or Esc) to close */}
      {preview && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in" onClick={() => setPreview(null)}>
          <button
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 w-10 h-10 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer transition"
            aria-label="Close preview"
          >
            <X size={20} />
          </button>
          <img src={preview} alt="" className="max-w-full max-h-full object-contain rounded-lg select-none" draggable={false} />
        </div>
      )}
    </div>
  )
}

// Customer-facing preset reasons — these go verbatim into the cancellation email.
const CANCEL_REASONS = [
  'This item is currently out of stock',
  'We are unable to deliver to your PIN code',
  'Cancelled on your request',
  'There was an issue with the payment',
]

// Cancel an order with a reason. The reason is emailed to the customer along
// with a refund note if they paid anything (online full or COD advance).
function CancelSheet({ o, onClose, onConfirm }) {
  const [show, setShow] = useState(false)
  const [reason, setReason] = useState(CANCEL_REASONS[0])
  const [custom, setCustom] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const close = () => { setShow(false); setTimeout(onClose, 200) }

  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true))
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => { cancelAnimationFrame(id); window.removeEventListener('keydown', onKey) }
  }, []) // eslint-disable-line

  const finalReason = custom ? text.trim() : reason
  const paidAmt = o.paymentStatus === 'paid' ? Number(o.total || 0) : Number(o.advancePaid || 0)

  const confirm = async () => {
    setSaving(true)
    try { await onConfirm(finalReason) } catch (e) { window.alert(e?.message || 'Could not cancel the order'); setSaving(false) }
  }

  return (
    <div id="cancel-sheet-root" className="fixed inset-0 z-[70]">
      <div className={`absolute inset-0 bg-zinc-900/50 transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`} onClick={close} />
      <div className="absolute inset-0 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
        <div className={`pointer-events-auto w-full sm:max-w-md bg-zinc-50 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden transition-all duration-200 ease-out ${show ? 'translate-y-0 opacity-100' : 'translate-y-full sm:translate-y-4 sm:opacity-0'}`}>

          <div className="sm:hidden pt-2.5 grid place-items-center bg-white"><span className="w-10 h-1 rounded-full bg-zinc-200" /></div>

          {/* Header */}
          <div className="bg-white px-5 pt-2.5 sm:pt-5 pb-4 border-b border-zinc-100 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-red-400 font-bold">Cancel order</p>
                <p className="font-extrabold text-[17px] text-zinc-900 tracking-tight mt-0.5">{o.orderNo}</p>
              </div>
              <button onClick={close} className="w-9 h-9 grid place-items-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer transition shrink-0" aria-label="Close">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <p className="text-[13px] text-zinc-500 px-1">The customer is emailed this reason, so it's written to them. Reserved stock returns to inventory.</p>

            <div className="space-y-1.5">
              {CANCEL_REASONS.map((r) => {
                const on = !custom && reason === r
                return (
                  <button
                    key={r}
                    onClick={() => { setCustom(false); setReason(r) }}
                    className="w-full text-left px-3.5 py-3 rounded-xl text-[13px] font-semibold cursor-pointer transition-colors flex items-center justify-between gap-2"
                    style={on
                      ? { background: 'color-mix(in srgb, var(--maroon) 8%, white)', color: 'var(--maroon)', boxShadow: 'inset 0 0 0 1.5px var(--maroon)' }
                      : { background: '#fff', color: '#52525b', boxShadow: 'inset 0 0 0 1px #e4e4e7' }}
                  >
                    {r}
                    {on && <Check size={15} strokeWidth={3} className="shrink-0" />}
                  </button>
                )
              })}
              <button
                onClick={() => setCustom(true)}
                className="w-full text-left px-3.5 py-3 rounded-xl text-[13px] font-semibold cursor-pointer transition-colors flex items-center justify-between gap-2"
                style={custom
                  ? { background: 'color-mix(in srgb, var(--maroon) 8%, white)', color: 'var(--maroon)', boxShadow: 'inset 0 0 0 1.5px var(--maroon)' }
                  : { background: '#fff', color: '#52525b', boxShadow: 'inset 0 0 0 1px #e4e4e7' }}
              >
                Write my own reason…
                {custom && <Check size={15} strokeWidth={3} className="shrink-0" />}
              </button>
              {custom && (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Reason shown to the customer…"
                  className="w-full px-3.5 py-3 rounded-xl text-[13px] bg-white outline-none resize-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-[var(--maroon)] transition"
                />
              )}
            </div>

            {/* Refund situation */}
            {paidAmt > 0 ? (
              <div className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed" style={{ background: 'color-mix(in srgb, #f59e0b 12%, white)' }}>
                <p className="font-bold text-amber-700">Customer paid {fmt(paidAmt)}{o.paymentStatus === 'paid' ? ' online' : ' as advance'}</p>
                <p className="text-amber-700/90 text-[12px] mt-0.5">The email tells them it will be refunded in 5–7 business days. <b>Refund it from your Razorpay dashboard</b> — it is not automatic.</p>
              </div>
            ) : (
              <p className="text-[12px] text-zinc-400 px-1">No payment was taken for this order — nothing to refund.</p>
            )}
          </div>

          {/* Footer */}
          <div className="bg-white border-t border-zinc-100 p-4 shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <button
              onClick={confirm}
              disabled={saving || (custom && !text.trim())}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-[14px] font-bold text-white cursor-pointer transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-default"
              style={{ background: '#dc2626' }}
            >
              <XCircle size={16} /> {saving ? 'Cancelling…' : 'Cancel order & email customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Bulk-book Shiprocket for the selected orders using default weights
// (defaultWeightKg × items per order). One request books everything
// sequentially server-side and clubs a single pickup; partial failures stay
// in To Ship with their reasons shown here.
function BulkShipSheet({ orders, srCfg, onClose, onDone }) {
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null) // { booked, failed, pickupScheduled }
  const [err, setErr] = useState('')
  const srReady = !!srCfg?.ready
  const close = () => { setShow(false); setTimeout(result ? onDone : onClose, 200) }

  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true))
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape' && !saving) close() }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [saving, result]) // eslint-disable-line

  const wKg = (o) => (((srCfg?.defaultWeightKg || 0.3) * ((o.items || []).reduce((a, i) => a + (i.qty || 0), 0) || 1))).toFixed(2)

  const submit = async () => {
    setSaving(true); setErr('')
    try {
      const r = await api.post('/orders/bulk-ship', { ids: orders.map((o) => o._id) }, { auth: true })
      setResult(r || { booked: [], failed: [] })
    } catch (e) {
      setErr(e?.message || 'Bulk booking failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <div className={`absolute inset-0 bg-zinc-900/50 transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`} onClick={() => !saving && close()} />
      <div className="absolute inset-0 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
        <div className={`pointer-events-auto w-full sm:max-w-md bg-zinc-50 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden transition-all duration-200 ease-out ${show ? 'translate-y-0 opacity-100' : 'translate-y-full sm:translate-y-4 sm:opacity-0'}`}>

          <div className="sm:hidden pt-2.5 grid place-items-center bg-white"><span className="w-10 h-1 rounded-full bg-zinc-200" /></div>

          {/* Header */}
          <div className="bg-white px-5 pt-2.5 sm:pt-5 pb-4 border-b border-zinc-100 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Bulk ship</p>
                <p className="font-extrabold text-[17px] text-zinc-900 tracking-tight mt-0.5">{result ? 'Booking results' : `${orders.length} order${orders.length === 1 ? '' : 's'} via Shiprocket`}</p>
              </div>
              <button onClick={close} disabled={saving} className="w-9 h-9 grid place-items-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer transition shrink-0 disabled:opacity-40" aria-label="Close">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {result ? (
              <>
                {result.booked?.length > 0 && (
                  <div className="bg-white rounded-2xl ring-1 ring-zinc-100 overflow-hidden">
                    <p className="px-4 pt-3 pb-2 text-[11px] uppercase tracking-wider font-bold text-emerald-600">Booked ({result.booked.length})</p>
                    <div className="divide-y divide-zinc-50">
                      {result.booked.map((b) => (
                        <div key={b.orderNo} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                          <span className="font-bold text-zinc-800">{b.orderNo}</span>
                          <span className="text-zinc-500 truncate">{b.courierName || 'Courier assigned'} · <span className="font-mono">{b.awb}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.failed?.length > 0 && (
                  <div className="bg-white rounded-2xl ring-1 ring-zinc-100 overflow-hidden">
                    <p className="px-4 pt-3 pb-2 text-[11px] uppercase tracking-wider font-bold text-red-500">Failed ({result.failed.length}) — still in To Ship</p>
                    <div className="divide-y divide-zinc-50">
                      {result.failed.map((f, i) => (
                        <div key={i} className="px-4 py-2.5 text-[13px]">
                          <span className="font-bold text-zinc-800">{f.orderNo}</span>
                          <p className="text-red-500 text-[12px] mt-0.5">{f.error}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[12px] text-zinc-400 px-1">
                  {result.pickupScheduled
                    ? 'One clubbed pickup has been requested for the whole batch.'
                    : 'Pickup not auto-scheduled — schedule it from the Shiprocket dashboard (or turn on auto-pickup in Settings).'}
                </p>
              </>
            ) : (
              <>
                {!srReady && (
                  <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, #f59e0b 12%, white)' }}>
                    <p className="font-semibold text-amber-700">Finish Shiprocket setup first</p>
                    <p className="text-amber-700/90 text-xs mt-0.5">Add the email, API password and pickup location in <b>Settings → Payments &amp; Shipping → Shiprocket</b>.</p>
                  </div>
                )}
                <p className="text-[13px] text-zinc-500 px-1">Each order books with its <b className="text-zinc-700">default weight</b> ({srCfg?.defaultWeightKg || 0.3} kg × items). Shiprocket assigns the recommended courier per order and the pickup is clubbed. Odd-sized parcels? Ship them individually instead.</p>
                <div className="bg-white rounded-2xl ring-1 ring-zinc-100 overflow-hidden">
                  <div className="divide-y divide-zinc-50">
                    {orders.map((o) => (
                      <div key={o._id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-zinc-800">{o.orderNo}</span>
                          <p className="text-zinc-400 truncate text-[12px]">{o.customer?.name}</p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${paymentMode(o) === 'COD' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{paymentMode(o)}</span>
                        <span className="text-zinc-500 shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{wKg(o)} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {err && <p className="text-[13px] font-semibold text-red-600 px-1">{err}</p>}
          </div>

          {/* Footer */}
          <div className="bg-white border-t border-zinc-100 p-4 shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            {result ? (
              <button onClick={close} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-[14px] font-bold text-white cursor-pointer transition-all hover:brightness-110 active:scale-[0.99]" style={{ background: 'var(--maroon)' }}>
                <Check size={16} strokeWidth={3} /> Done
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={saving || !srReady || orders.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-[14px] font-bold text-white cursor-pointer transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-default"
                style={{ background: 'var(--maroon)' }}
              >
                {saving ? <><RefreshCw size={15} className="animate-spin" /> Booking {orders.length} order{orders.length === 1 ? '' : 's'}…</> : <><Package size={16} /> Book {orders.length} & Ship</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Ship an order. When Shiprocket is configured, book a waybill via its API
// (auto-fills the customer tracking message); otherwise (or by choice) paste a
// manual tracking note the customer will see.
function ShipModal({ order, srCfg, onClose, onShipped }) {
  const alreadyShipped = order.status === 'shipped' || order.status === 'delivered'
  const mode = paymentMode(order)
  const totalQty = (order.items || []).reduce((a, i) => a + (i.qty || 0), 0) || 1
  const pin = order.address?.pincode
  const srReady = !!srCfg?.ready

  // Tabs: Shiprocket whenever enabled (incomplete setup shows what's missing)
  // + a Manual note fallback.
  const tabs = []
  if (!alreadyShipped && srCfg?.enabled) tabs.push({ v: 'shiprocket', label: 'Shiprocket' })
  tabs.push({ v: 'manual', label: 'Manual note' })

  // The store's shipping-routing preference RECOMMENDS a tab for this order
  // (badge + preselect); the admin can always tap the other one.
  //   all → Shiprocket for everything · cod → Shiprocket for COD, manual for
  //   prepaid · prepaid → the reverse · manual → no recommendation.
  const recommended = (() => {
    const pol = srCfg?.routing || 'manual'
    if (!srReady || pol === 'manual') return null
    if (pol === 'all') return 'shiprocket'
    if (pol === 'cod') return mode === 'COD' ? 'shiprocket' : 'manual'
    if (pol === 'prepaid') return mode === 'Prepaid' ? 'shiprocket' : 'manual'
    return null
  })()
  const [method, setMethod] = useState(!alreadyShipped && recommended ? recommended : 'manual')

  // Sheet entrance/exit + Esc + scroll lock (restores the drawer's lock state).
  const [show, setShow] = useState(false)
  const close = () => { setShow(false); setTimeout(onClose, 200) }
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true))
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, []) // eslint-disable-line

  const [message, setMessage] = useState(order.tracking?.message || '')
  const [kWeight, setKWeight] = useState(String(((srCfg?.defaultWeightKg || 0.3) * totalQty).toFixed(2))) // kg
  const [serv, setServ] = useState(null) // serviceability result
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Check serviceability when the Shiprocket tab is active.
  useEffect(() => {
    setServ(null)
    if (method !== 'shiprocket' || !srReady || !pin) return
    let live = true
    api.get(`/orders/shiprocket/serviceability?pin=${encodeURIComponent(pin)}&weight=${encodeURIComponent(kWeight || 0.5)}&cod=${mode === 'COD'}`, { auth: true })
      .then((r) => { if (live) setServ({ ok: true, ...r }) })
      .catch((e) => { if (live) setServ({ ok: false, error: e.message }) })
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

  const submitCourier = async () => {
    setSaving(true); setErr('')
    try {
      const w = Number(kWeight)
      const body = w > 0 ? { weight: w } : {}
      const updated = await api.post(`/orders/${order._id}/ship-shiprocket`, body, { auth: true })
      onShipped(updated)
    } catch (e) { setErr(e.message || 'Could not book this shipment'); setSaving(false) }
  }

  const missingMsg = [!srCfg?.hasCreds && 'email + API password', !srCfg?.hasPickup && 'pickup location'].filter(Boolean).join(' & ')
  const primaryLabel = method === 'manual'
    ? (saving ? 'Saving…' : (alreadyShipped ? 'Save message' : 'Mark Shipped'))
    : (saving ? 'Booking…' : 'Book Shiprocket & Ship')

  return (
    <div id="ship-modal-root" className="fixed inset-0 z-[70]">
      <div className={`absolute inset-0 bg-zinc-900/50 transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`} onClick={close} />
      <div className="absolute inset-0 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
        <div className={`pointer-events-auto w-full sm:max-w-md bg-zinc-50 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden transition-all duration-200 ease-out ${show ? 'translate-y-0 opacity-100' : 'translate-y-full sm:translate-y-4 sm:opacity-0'}`}>

          {/* Grab handle (mobile bottom sheet) */}
          <div className="sm:hidden pt-2.5 grid place-items-center bg-white"><span className="w-10 h-1 rounded-full bg-zinc-200" /></div>

          {/* Header */}
          <div className="bg-white px-5 pt-2.5 sm:pt-5 pb-4 border-b border-zinc-100 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">{alreadyShipped ? 'Edit tracking' : 'Ship order'}</p>
                <p className="font-extrabold text-[17px] text-zinc-900 tracking-tight mt-0.5">{order.orderNo}</p>
              </div>
              <button onClick={close} className="w-9 h-9 grid place-items-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer transition shrink-0" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {tabs.length > 1 && (
              <div className="grid grid-cols-2 gap-1.5 mt-3.5">
                {tabs.map(({ v, label }) => {
                  const on = method === v
                  const rec = recommended === v && !alreadyShipped
                  return (
                    <button
                      key={v}
                      onClick={() => { setMethod(v); setErr('') }}
                      className="py-2 rounded-xl text-[12px] font-bold text-center cursor-pointer transition-colors"
                      style={on
                        ? { background: 'color-mix(in srgb, var(--maroon) 10%, white)', color: 'var(--maroon)', boxShadow: 'inset 0 0 0 1.5px var(--maroon)' }
                        : { background: '#fff', color: '#71717a', boxShadow: 'inset 0 0 0 1px #e4e4e7' }}
                    >
                      {label}
                      {rec && <span className="block text-[9px] font-extrabold uppercase tracking-wider mt-0.5" style={{ color: '#b8922e' }}>★ Recommended</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {method === 'manual' ? (
              <div className="bg-white rounded-2xl ring-1 ring-zinc-100 p-4">
                <Field field={{ label: 'Tracking message', type: 'textarea', placeholder: 'e.g. Shipped via India Post. Tracking: 1234567890 — https://…' }} value={message} onChange={setMessage} />
                <p className="text-[12px] text-zinc-400 mt-2">Paste the courier's note (tracking id + link). It's shown to the customer exactly as typed.</p>
              </div>
            ) : (
              <>
                {!srReady && (
                  <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, #f59e0b 12%, white)' }}>
                    <p className="font-semibold text-amber-700">Finish Shiprocket setup first</p>
                    <p className="text-amber-700/90 text-xs mt-0.5">
                      Missing {missingMsg}. Go to <b>Settings → Payments &amp; Shipping → Shiprocket</b>, fill them in, and hit <b>Save Changes</b>.
                    </p>
                  </div>
                )}

                <p className="text-[13px] text-zinc-500 px-1">
                  Books a Shiprocket waybill as <b className="text-zinc-700">{mode}</b>
                  {mode === 'COD' && <> — collect <b className="text-zinc-700">{fmt(Math.max(0, (order.total || 0) - (order.advancePaid || 0)))}</b> on delivery</>}.
                  The customer's tracking link is filled in automatically.
                </p>

                {/* Serviceability */}
                <div className="bg-white rounded-2xl ring-1 ring-zinc-100 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Delivery to PIN {pin || '—'}</p>
                  <div className="mt-1.5 text-[13px] font-medium">
                    {!pin ? <p className="text-red-600">No PIN on this order — add one before booking.</p>
                      : !srReady ? <p className="text-zinc-400">Finish setup to check serviceability.</p>
                      : !serv ? <p className="text-zinc-400 flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> Checking serviceability…</p>
                      : !serv.ok ? <p className="text-amber-600">Couldn't verify ({serv.error}). You can still try to book.</p>
                      : !serv.serviceable ? <p className="text-red-600">Not serviceable by Shiprocket. Ship manually instead.</p>
                      : <p className="text-emerald-700">Serviceable · {serv.couriers?.length || 0} courier(s){serv.cheapest ? ` · from ₹${Math.round(serv.cheapest.rate || 0)} (${serv.cheapest.name})` : ''}. Shiprocket picks the recommended one.</p>}
                  </div>
                </div>

                {/* Weight */}
                <div className="bg-white rounded-2xl ring-1 ring-zinc-100 p-4">
                  <Field field={{ label: 'Package weight (kg)', type: 'number', help: `Default ${srCfg?.defaultWeightKg || 0.3} kg × ${totalQty} item(s). Adjust if needed.` }} value={kWeight} onChange={setKWeight} />
                </div>
              </>
            )}
            {err && <p className="text-[13px] font-semibold text-red-600 px-1">{err}</p>}
          </div>

          {/* Footer — one full-width action */}
          <div className="bg-white border-t border-zinc-100 p-4 shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <button
              onClick={method === 'manual' ? submitManual : submitCourier}
              disabled={saving || (method !== 'manual' && !srReady)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-[14px] font-bold text-white cursor-pointer transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-default"
              style={{ background: 'var(--maroon)' }}
            >
              {method === 'manual' ? <Truck size={16} /> : <Package size={16} />} {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
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
