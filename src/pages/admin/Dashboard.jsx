import { useEffect, useState } from 'react'
import { Eye, Users, ShoppingCart, IndianRupee, Loader2, Smartphone, Monitor, Tablet, Receipt, Percent, Clock, Rocket, AlertTriangle } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn, Modal } from '../../components/admin/AdminUI.jsx'
import { Dropdown } from '../../components/ui/Dropdown.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const nf = (n) => new Intl.NumberFormat('en-IN').format(n || 0)

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
  const [days, setDays] = useState(30)
  const [goLive, setGoLive] = useState(false)

  const load = () => api.get(`/analytics/summary?days=${days}`, { auth: true }).then(setData)
  useEffect(() => { load() }, [days]) // eslint-disable-line

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: 'var(--gold)' }} /></div>

  const kpis = [
    { icon: Eye, label: 'Page views', value: nf(data.totalViews), tint: 'text-blue-500 bg-blue-50', spark: 'views', sparkColor: '#3b82f6' },
    { icon: Users, label: 'Unique visitors', value: nf(data.uniqueSessions), tint: 'text-violet-500 bg-violet-50', spark: 'visitors', sparkColor: '#8b5cf6' },
    { icon: ShoppingCart, label: 'Orders', value: nf(data.orders), tint: 'text-emerald-500 bg-emerald-50' },
    { icon: IndianRupee, label: 'Revenue', value: fmt(data.revenue), tint: 'bg-[color-mix(in_srgb,var(--gold)_14%,white)]', iconColor: 'var(--gold)' },
  ]

  const totalDev = (data.deviceSplit || []).reduce((a, d) => a + d.count, 0) || 1

  const dash = '—'
  const insights = [
    { icon: Receipt, label: 'Avg order value', value: data.orders ? fmt(Math.round(data.revenue / data.orders)) : dash, hint: 'Revenue ÷ orders' },
    { icon: Percent, label: 'Conversion', value: data.uniqueSessions ? `${((data.orders / data.uniqueSessions) * 100).toFixed(1)}%` : dash, hint: 'Orders ÷ visitors' },
    { icon: Eye, label: 'Views / visitor', value: data.uniqueSessions ? (data.totalViews / data.uniqueSessions).toFixed(1) : dash, hint: 'Engagement depth' },
    { icon: Clock, label: 'Views today', value: nf(data.todayViews), hint: 'So far today' },
  ]

  return (
    <div>
      <AdminHeader title="Dashboard" subtitle={`Last ${days} days · ${nf(data.todayViews)} views today`}>
        <Btn variant="outline" onClick={() => setGoLive(true)}><Rocket size={15} /> Go Live</Btn>
        <Dropdown
          value={days}
          onChange={setDays}
          options={[7, 30, 90, 365].map((d) => ({ value: d, label: `Last ${d} days` }))}
        />
      </AdminHeader>
      {goLive && <GoLiveModal onClose={() => setGoLive(false)} onDone={load} />}

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

      {/* Insight stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        {insights.map(({ icon: Icon, label, value, hint }) => (
          <div key={label} className="admin-card p-4 md:p-5">
            <div className="flex items-center gap-2 text-zinc-400"><Icon size={15} /><span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span></div>
            <p className="text-2xl md:text-[26px] font-bold leading-none mt-2.5 tracking-tight text-zinc-900">{value}</p>
            <p className="text-[11px] text-zinc-400 mt-1.5">{hint}</p>
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
    </div>
  )
}

// One-time launch reset: wipes test visits + orders (+ payment intents) for a
// clean slate, keeping all configured data (products, settings, content…).
function GoLiveModal({ onClose, onDone }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const armed = text.trim().toUpperCase() === 'GO LIVE'

  const run = async () => {
    if (!armed) return
    setBusy(true); setErr('')
    try {
      const res = await api.post('/analytics/go-live', { confirm: 'GO_LIVE' }, { auth: true })
      setDone(res)
      onDone?.()
    } catch (e) { setErr(e.message || 'Could not reset'); setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Go Live — clean slate" footer={done ? (
      <Btn onClick={onClose}>Done</Btn>
    ) : (<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="danger" onClick={run} disabled={!armed || busy}>{busy ? 'Resetting…' : 'Reset & Go Live'}</Btn>
    </>)}>
      {done ? (
        <div className="text-sm text-zinc-700 space-y-1">
          <p className="font-semibold text-emerald-600">You're live! 🚀</p>
          <p>Cleared {done.orders} order(s), {done.visits} visit(s), {done.intents} payment session(s).</p>
          <p>Restored stock for {done.stockRestored} order(s). Products, settings and content are untouched.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2.5 rounded-xl p-3" style={{ background: 'color-mix(in srgb, #f59e0b 12%, transparent)' }}>
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-zinc-700">This permanently deletes <b>all orders</b> and <b>all analytics</b> (page views, visitors) so you launch with real numbers. It <b>keeps</b> your products, settings, content, categories, collections, coupons and customers. Stock reserved by test orders is restored.</p>
          </div>
          <label className="block text-sm text-zinc-600">Type <b>GO LIVE</b> to confirm:</label>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="GO LIVE" className="w-full px-3 py-2 rounded-xl border border-zinc-300 outline-none focus:border-[var(--gold)]" />
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      )}
    </Modal>
  )
}
