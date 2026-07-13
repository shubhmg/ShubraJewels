import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader2, IndianRupee, ShoppingCart, Package, TrendingUp } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader } from '../../components/admin/AdminUI.jsx'
import { Dropdown } from '../../components/ui/Dropdown.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n || 0))
const fmtC = (n) => '₹' + new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)
const nf = (n) => new Intl.NumberFormat('en-IN').format(n || 0)

// Local YYYY-MM-DD (the store + admin both run in IST, which the server assumes).
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d }

const STATUS_OPTS = [
  { value: '', label: 'All sales (excl. cancelled)' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]
const PAY_OPTS = [
  { value: '', label: 'All payments' },
  { value: 'razorpay', label: 'Online (Razorpay)' },
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
]
const PAY_LABEL = { razorpay: 'Online', cod: 'COD', upi: 'UPI', cash: 'Cash', bank: 'Bank', whatsapp: 'WhatsApp', none: 'Other' }
const STATUS_COLOR = { confirmed: '#C9A84C', shipped: '#7B1E2B', delivered: '#059669', cancelled: '#DC2626' }

const PRESETS = [
  { key: '7d', label: '7 days', range: () => [ymd(daysAgo(6)), ymd(new Date())] },
  { key: '30d', label: '30 days', range: () => [ymd(daysAgo(29)), ymd(new Date())] },
  { key: '90d', label: '90 days', range: () => [ymd(daysAgo(89)), ymd(new Date())] },
  { key: 'month', label: 'This month', range: () => { const n = new Date(); return [ymd(new Date(n.getFullYear(), n.getMonth(), 1)), ymd(n)] } },
  { key: 'year', label: 'This year', range: () => { const n = new Date(); return [ymd(new Date(n.getFullYear(), 0, 1)), ymd(n)] } },
]

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload || {}
  return (
    <div className="rounded-xl px-3 py-2 shadow-lg text-xs" style={{ background: '#fff', border: '1px solid var(--gold, #C9A84C)' }}>
      <p className="font-semibold text-zinc-700 mb-1">{new Date(label).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
      <p style={{ color: 'var(--maroon, #7B1E2B)' }} className="font-bold">{fmt(p.revenue)}</p>
      <p className="text-zinc-400">{nf(p.orders)} order{p.orders === 1 ? '' : 's'}</p>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="admin-card p-4">
      <div className="w-9 h-9 rounded-xl grid place-items-center mb-3" style={{ background: 'color-mix(in srgb, var(--gold) 16%, transparent)' }}>
        <Icon size={17} style={{ color: 'var(--maroon)' }} />
      </div>
      <p className="text-2xl font-bold text-zinc-900 leading-none">{value}</p>
      <p className="text-xs text-zinc-500 mt-1.5">{label}</p>
      {sub != null && <p className="text-[11px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function AdminReports() {
  const [preset, setPreset] = useState('30d')
  const [from, setFrom] = useState(() => ymd(daysAgo(29)))
  const [to, setTo] = useState(() => ymd(new Date()))
  const [status, setStatus] = useState('')
  const [payment, setPayment] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const applyPreset = (key) => {
    const p = PRESETS.find((x) => x.key === key)
    if (!p) return
    const [f, t] = p.range()
    setPreset(key); setFrom(f); setTo(t)
  }
  const onDate = (setter) => (v) => { setter(v); setPreset('custom') }

  useEffect(() => {
    let alive = true
    setLoading(true)
    const qs = new URLSearchParams({ from, to, status, paymentMethod: payment }).toString()
    api.get(`/analytics/sales?${qs}`, { auth: true })
      .then((d) => { if (alive) setData(d) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [from, to, status, payment])

  const s = data?.summary
  const maxPay = useMemo(() => Math.max(1, ...(data?.byPayment || []).map((p) => p.revenue)), [data])
  const topMax = useMemo(() => Math.max(1, ...(data?.topProducts || []).map((p) => p.revenue)), [data])

  return (
    <div>
      <AdminHeader title="Sales Report" subtitle={data ? `${from} → ${to}` : 'Loading…'} />

      {/* Filters */}
      <div className="admin-card p-3 md:p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer border ${
                preset === p.key ? 'text-white border-transparent' : 'bg-white text-zinc-500 border-zinc-200 hover:border-[var(--gold)]'
              }`}
              style={preset === p.key ? { background: 'var(--maroon)' } : undefined}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-500">
            <span className="block mb-1 font-medium">From</span>
            <input type="date" value={from} max={to} onChange={(e) => onDate(setFrom)(e.target.value)}
              className="px-3 py-2 rounded-xl border border-zinc-300 bg-white text-sm outline-none focus:border-[var(--gold)]" />
          </label>
          <label className="text-xs text-zinc-500">
            <span className="block mb-1 font-medium">To</span>
            <input type="date" value={to} min={from} max={ymd(new Date())} onChange={(e) => onDate(setTo)(e.target.value)}
              className="px-3 py-2 rounded-xl border border-zinc-300 bg-white text-sm outline-none focus:border-[var(--gold)]" />
          </label>
          <div className="text-xs text-zinc-500">
            <span className="block mb-1 font-medium">Status</span>
            <Dropdown value={status} onChange={setStatus} options={STATUS_OPTS} align="left" />
          </div>
          <div className="text-xs text-zinc-500">
            <span className="block mb-1 font-medium">Payment</span>
            <Dropdown value={payment} onChange={setPayment} options={PAY_OPTS} align="left" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="animate-spin" style={{ color: 'var(--gold)' }} /></div>
      ) : !s ? (
        <p className="text-center text-zinc-400 py-24 text-sm">No data.</p>
      ) : (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={IndianRupee} label="Revenue" value={fmt(s.revenue)} sub={s.discount > 0 ? `${fmt(s.discount)} discounts given` : null} />
            <Kpi icon={ShoppingCart} label="Orders" value={nf(s.orders)} sub={status ? STATUS_OPTS.find((o) => o.value === status)?.label : 'excl. cancelled'} />
            <Kpi icon={Package} label="Units sold" value={nf(s.units)} />
            <Kpi icon={TrendingUp} label="Avg order value" value={fmt(s.avgOrderValue)} />
          </div>

          {s.orders === 0 ? (
            <div className="admin-card p-12 text-center text-zinc-400 text-sm">No orders in this range. Try widening the dates or clearing filters.</div>
          ) : (
            <>
              {/* Revenue trend */}
              <div className="admin-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-zinc-800">Revenue trend</h2>
                  <span className="text-xs text-zinc-400">{fmt(s.revenue)} total</span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.series} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="salesRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--gold, #C9A84C)" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="var(--gold, #C9A84C)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false}
                      tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      minTickGap={28} />
                    <YAxis tickFormatter={fmtC} tick={{ fontSize: 11, fill: '#a8a29e' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="revenue" stroke="var(--maroon, #7B1E2B)" strokeWidth={2.5} fill="url(#salesRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Payment breakdown */}
                <div className="admin-card p-4">
                  <h2 className="font-semibold text-zinc-800 mb-4">By payment method</h2>
                  <div className="space-y-3">
                    {(data.byPayment || []).map((p) => (
                      <div key={p.method}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-zinc-600">{PAY_LABEL[p.method] || p.method} <span className="text-zinc-400">· {nf(p.orders)}</span></span>
                          <span className="font-semibold text-zinc-800">{fmt(p.revenue)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(p.revenue / maxPay) * 100}%`, background: 'linear-gradient(90deg, var(--maroon), var(--gold))' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status breakdown */}
                <div className="admin-card p-4">
                  <h2 className="font-semibold text-zinc-800 mb-4">By order status</h2>
                  <div className="space-y-2.5">
                    {(data.byStatus || []).sort((a, b) => b.revenue - a.revenue).map((p) => (
                      <div key={p.status} className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[p.status] || '#a8a29e' }} />
                        <span className="text-sm text-zinc-600 capitalize flex-1">{p.status}</span>
                        <span className="text-xs text-zinc-400">{nf(p.orders)} ord</span>
                        <span className="text-sm font-semibold text-zinc-800 w-24 text-right">{fmt(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top products */}
              <div className="admin-card p-4">
                <h2 className="font-semibold text-zinc-800 mb-4">Top products by revenue</h2>
                {(data.topProducts || []).length === 0 ? (
                  <p className="text-sm text-zinc-400 py-6 text-center">No items.</p>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {data.topProducts.map((p, i) => (
                      <div key={String(p.productId) + i} className="flex items-center gap-3 py-2.5">
                        <span className="w-6 text-center text-xs font-bold text-zinc-400 shrink-0">{i + 1}</span>
                        {p.image
                          ? <img src={p.image} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                          : <div className="w-11 h-11 rounded-lg bg-zinc-100 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-800 truncate">{p.name}</p>
                          <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden mt-1.5 max-w-[240px]">
                            <div className="h-full rounded-full" style={{ width: `${(p.revenue / topMax) * 100}%`, background: 'linear-gradient(90deg, var(--gold), var(--gold-light))' }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-zinc-900 leading-none">{fmt(p.revenue)}</p>
                          <p className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1 flex items-center gap-1 justify-end"><Package size={11} /> {nf(p.units)} sold</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
