import { useEffect, useState } from 'react'
import { Eye, Users, ShoppingCart, IndianRupee, Loader2, Database, Trash2, Sparkles, Smartphone, Monitor, Tablet, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn } from '../../components/admin/AdminUI.jsx'
import { Dropdown } from '../../components/ui/Dropdown.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const nf = (n) => new Intl.NumberFormat('en-IN').format(n || 0)

const STATUS_TINT = {
  pending: 'bg-amber-50 text-amber-600', confirmed: 'bg-blue-50 text-blue-600',
  shipped: 'bg-violet-50 text-violet-600', delivered: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-red-50 text-red-600',
}
const DEVICE_ICON = { mobile: Smartphone, desktop: Monitor, tablet: Tablet, unknown: Monitor }

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white shadow-lg ring-1 ring-zinc-200 px-3 py-2 text-xs">
      <p className="font-semibold text-zinc-700 mb-1.5">{label?.slice(5)}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 leading-5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-500">{p.name}</span>
          <span className="font-semibold text-zinc-800 ml-4">{nf(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function Spark({ data, dataKey, color }) {
  if (!data?.length) return <div className="h-9" />
  const id = `sp-${dataKey}`
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.6} fill={`url(#${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function AdminDashboard() {
  const [data, setData] = useState(null)
  const [orders, setOrders] = useState([])
  const [days, setDays] = useState(30)

  useEffect(() => {
    api.get(`/analytics/summary?days=${days}`, { auth: true }).then(setData)
  }, [days])
  useEffect(() => {
    api.get('/orders', { auth: true }).then((o) => setOrders(o.slice(0, 6)))
  }, [])

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: 'var(--gold)' }} /></div>

  const kpis = [
    { icon: Eye, label: 'Page views', value: nf(data.totalViews), tint: 'text-blue-500 bg-blue-50', spark: 'views', sparkColor: '#3b82f6' },
    { icon: Users, label: 'Unique visitors', value: nf(data.uniqueSessions), tint: 'text-violet-500 bg-violet-50', spark: 'visitors', sparkColor: '#8b5cf6' },
    { icon: ShoppingCart, label: 'Orders', value: nf(data.orders), tint: 'text-emerald-500 bg-emerald-50' },
    { icon: IndianRupee, label: 'Revenue', value: fmt(data.revenue), tint: 'bg-[color-mix(in_srgb,var(--gold)_14%,white)]', iconColor: 'var(--gold)' },
  ]

  const maxPage = Math.max(...(data.topPages || []).map((p) => p.views), 1)
  const totalDev = (data.deviceSplit || []).reduce((a, d) => a + d.count, 0) || 1

  return (
    <div>
      <AdminHeader title="Dashboard" subtitle={`Last ${days} days · ${nf(data.todayViews)} views today`}>
        <Dropdown
          value={days}
          onChange={setDays}
          options={[7, 30, 90, 365].map((d) => ({ value: d, label: `Last ${d} days` }))}
        />
      </AdminHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        {kpis.map(({ icon: Icon, label, value, tint, iconColor, spark, sparkColor }) => (
          <div key={label} className="admin-card p-4 md:p-5 transition-transform hover:-translate-y-0.5 flex flex-col">
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-xl grid place-items-center ${tint}`} style={iconColor ? { color: iconColor } : undefined}><Icon size={19} /></div>
            </div>
            <p className="text-2xl md:text-[28px] font-bold leading-none mt-3 tracking-tight text-zinc-900">{value}</p>
            <p className="text-[11px] text-zinc-400 mt-1.5 font-semibold uppercase tracking-wide">{label}</p>
            {spark && <div className="mt-2 -mb-1"><Spark data={data.series} dataKey={spark} color={sparkColor} /></div>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        {/* Traffic chart */}
        <div className="lg:col-span-2 admin-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-semibold text-lg text-zinc-900">Traffic</h2>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--maroon)' }} /> Visitors</span>
              <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--gold)' }} /> Page views</span>
            </div>
          </div>
          {data.series?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.series} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="gVis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--maroon)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--maroon)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gView" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#00000008" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickFormatter={(d) => d?.slice(5)} minTickGap={28} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="views" stroke="var(--gold)" fill="url(#gView)" strokeWidth={1.6} name="Page views" isAnimationActive={false} />
                <Area type="monotone" dataKey="visitors" stroke="var(--maroon)" fill="url(#gVis)" strokeWidth={2.2} name="Visitors" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-stone-400 py-20 text-sm">No visits yet. Browse the storefront to generate data.</p>
          )}
        </div>

        {/* Top pages */}
        <div className="admin-card p-4 md:p-5">
          <h2 className="font-semibold text-lg text-zinc-900 mb-4">Top Pages</h2>
          <div className="space-y-3">
            {(data.topPages || []).map((p) => (
              <div key={p.path}>
                <div className="flex items-center justify-between gap-2 text-[13px] mb-1">
                  <span className="truncate text-zinc-700" title={p.path}>{p.label || p.path}</span>
                  <span className="font-semibold text-zinc-900 shrink-0">{nf(p.views)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(p.views / maxPage) * 100}%`, background: 'linear-gradient(90deg, var(--gold), var(--gold-light))' }} />
                </div>
              </div>
            ))}
            {!data.topPages?.length && <p className="text-stone-400 text-sm">No data yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-6 mt-4 md:mt-6">
        {/* Recent orders */}
        <div className="lg:col-span-2 admin-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg text-zinc-900">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: 'var(--maroon)' }}>View all <ArrowRight size={13} /></Link>
          </div>
          {orders.length ? (
            <div className="space-y-1">
              {orders.map((o) => (
                <div key={o._id} className="flex items-center gap-3 py-2.5 border-b border-zinc-100 last:border-0 text-sm">
                  <div className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold shrink-0" style={{ background: 'color-mix(in srgb, var(--maroon) 10%, transparent)', color: 'var(--maroon)' }}>
                    {(o.customer?.name || '?')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-800 truncate">{o.customer?.name || 'Guest'}</p>
                    <p className="text-xs text-zinc-400">{o.orderNo}</p>
                  </div>
                  <span className="ml-auto font-semibold text-zinc-900 shrink-0">{fmt(o.total)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0 ${STATUS_TINT[o.status] || 'bg-zinc-100 text-zinc-500'}`}>{o.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-stone-400 text-sm py-6">No orders yet.</p>
          )}
        </div>

        {/* Device split */}
        <div className="admin-card p-4 md:p-5">
          <h2 className="font-semibold text-lg text-zinc-900 mb-4">Devices</h2>
          {data.deviceSplit?.length ? (
            <div className="space-y-4">
              {[...data.deviceSplit].sort((a, b) => b.count - a.count).map((d) => {
                const Icon = DEVICE_ICON[d.device] || Monitor
                const pct = Math.round((d.count / totalDev) * 100)
                return (
                  <div key={d.device}>
                    <div className="flex items-center gap-2 text-[13px] mb-1.5">
                      <Icon size={15} className="text-zinc-400" />
                      <span className="capitalize text-zinc-700">{d.device}</span>
                      <span className="ml-auto font-semibold text-zinc-900">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--maroon)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-stone-400 text-sm">No data yet.</p>
          )}
        </div>
      </div>

      <DemoDataCard />
    </div>
  )
}

// Seed / clear the sample content — handy for seeing what's DB-driven vs static.
function DemoDataCard() {
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)

  const seed = async () => {
    setBusy('seed'); setMsg(null)
    try {
      const { seeded } = await api.post('/admin/seed', {}, { auth: true })
      const parts = Object.entries(seeded).map(([k, v]) => `${v} ${k}`)
      setMsg(parts.length ? `Added: ${parts.join(', ')}.` : 'Nothing to add — everything already has data.')
    } catch (e) { setMsg(e.message) } finally { setBusy('') }
  }

  const clear = async () => {
    if (!confirm('Delete ALL content — products, categories, collections, banners, videos, reviews, gallery?\n\nYour orders, settings and login are kept. This cannot be undone.')) return
    setBusy('clear'); setMsg(null)
    try {
      const { cleared } = await api.post('/admin/clear', {}, { auth: true })
      const total = Object.values(cleared).reduce((a, b) => a + b, 0)
      setMsg(`Cleared ${total} items. The storefront now shows only static parts.`)
    } catch (e) { setMsg(e.message) } finally { setBusy('') }
  }

  return (
    <div className="admin-card p-5 mt-6">
      <div className="flex items-center gap-2 mb-1">
        <Database size={16} className="text-gold-500" />
        <h2 className="font-semibold text-lg text-dark-900 dark:text-cream-50">Sample Data</h2>
      </div>
      <p className="text-sm text-stone-400 mb-4">
        Seed fills empty sections with demo jhumkas. Clear empties everything DB-driven — whatever still shows on the site after clearing is hardcoded, not from the database.
      </p>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={seed} disabled={!!busy}><Sparkles size={16} /> {busy === 'seed' ? 'Seeding…' : 'Seed sample data'}</Btn>
        <Btn variant="danger" onClick={clear} disabled={!!busy}><Trash2 size={16} /> {busy === 'clear' ? 'Clearing…' : 'Clear all content'}</Btn>
      </div>
      {msg && <p className="text-sm text-stone-500 dark:text-stone-300 mt-3">{msg}</p>}
    </div>
  )
}
