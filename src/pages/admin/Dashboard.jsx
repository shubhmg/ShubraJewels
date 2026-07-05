import { useEffect, useState } from 'react'
import { Eye, Users, ShoppingCart, IndianRupee, Loader2, Smartphone, Monitor, Tablet, Receipt, Percent, Clock } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { api } from '../../lib/api.js'
import { AdminHeader } from '../../components/admin/AdminUI.jsx'
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

  useEffect(() => {
    api.get(`/analytics/summary?days=${days}`, { auth: true }).then(setData)
  }, [days])

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
