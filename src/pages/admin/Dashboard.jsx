import { useEffect, useState } from 'react'
import { Users, Loader2, Smartphone, Monitor, Tablet } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { api } from '../../lib/api.js'
import { AdminHeader } from '../../components/admin/AdminUI.jsx'
import { Dropdown } from '../../components/ui/Dropdown.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const nf = (n) => new Intl.NumberFormat('en-IN').format(n || 0)

// "2026-07-30" → "30 Jul" for chart axis + tooltip labels.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dLabel = (day) => {
  const [, m, d] = String(day || '').split('-')
  return m ? `${Number(d)} ${MONTHS[Number(m) - 1]}` : day
}

const DEVICE_ICON = { mobile: Smartphone, desktop: Monitor, tablet: Tablet, unknown: Monitor }

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white shadow-lg ring-1 ring-zinc-200 px-3 py-2 text-xs">
      <p className="font-semibold text-zinc-700 mb-1.5">{dLabel(label)}</p>
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

// A single inline metric on the maroon hero band.
function HeroStat({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-xl md:text-2xl font-bold tracking-tight leading-none" style={{ color: 'var(--cream)' }}>{value}</span>
      <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'color-mix(in srgb, var(--cream) 62%, transparent)' }}>{label}</span>
    </div>
  )
}

// One row of the new-vs-returning split legend.
function SplitLegend({ color, label, value, pct }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-zinc-600">{label}</span>
      <span className="ml-auto font-semibold text-zinc-900">{value}</span>
      <span className="text-zinc-400 tabular-nums w-9 text-right">{pct}%</span>
    </div>
  )
}

export function AdminDashboard() {
  const [data, setData] = useState(null)
  const [days, setDays] = useState(30)

  const load = () => api.get(`/analytics/summary?days=${days}`, { auth: true }).then(setData)
  useEffect(() => { load() }, [days]) // eslint-disable-line

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: 'var(--gold)' }} /></div>

  const totalDev = (data.deviceSplit || []).reduce((a, d) => a + d.count, 0) || 1

  const dash = '—'
  const conv = data.uniqueSessions ? `${((data.orders / data.uniqueSessions) * 100).toFixed(1)}%` : dash
  const aov = data.orders ? fmt(Math.round(data.revenue / data.orders)) : dash
  // Yesterday's visitors from the daily series (IST day key, matching the backend).
  const yesterdayStr = new Date(Date.now() + 5.5 * 3600e3 - 24 * 3600e3).toISOString().slice(0, 10)
  const yesterdayVisitors = data.series?.length ? (data.series.find((s) => s.day === yesterdayStr)?.visitors || 0) : null

  const totalVR = (data.newVisitors || 0) + (data.returningVisitors || 0)
  const pctNew = totalVR ? Math.round((data.newVisitors / totalVR) * 100) : 0
  const pctRet = totalVR ? Math.round((data.returningVisitors / totalVR) * 100) : 0

  return (
    <div>
      <AdminHeader title="Dashboard" subtitle={`Store performance · last ${days} days`}>
        <Dropdown
          value={days}
          onChange={setDays}
          options={[7, 30, 90, 365].map((d) => ({ value: d, label: `Last ${d} days` }))}
        />
      </AdminHeader>

      {/* Hero band — money + today's traffic, the two things checked first */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 md:p-7 mb-4 md:mb-6"
        style={{ background: 'linear-gradient(135deg, var(--maroon) 0%, var(--maroon-dark) 100%)', boxShadow: '0 20px 44px -20px color-mix(in srgb, var(--maroon) 60%, transparent)' }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(620px 260px at 90% -30%, color-mix(in srgb, var(--gold) 40%, transparent), transparent 62%)' }} />
        <div className="relative flex flex-col lg:flex-row lg:items-stretch gap-6 lg:gap-8">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'color-mix(in srgb, var(--cream) 72%, transparent)' }}>Revenue · last {days} days</p>
            <p className="mt-2 text-4xl md:text-[52px] font-bold tracking-tight leading-none" style={{ color: 'var(--gold-light)' }}>{fmt(data.revenue)}</p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl">
              <HeroStat label="Orders" value={nf(data.orders)} />
              <HeroStat label="Visitors" value={nf(data.uniqueSessions)} />
              <HeroStat label="Conversion" value={conv} />
              <HeroStat label="Avg order" value={aov} />
            </div>
          </div>
          {/* Today's visitors + gold trend */}
          <div className="lg:w-64 lg:pl-8 lg:border-l" style={{ borderColor: 'color-mix(in srgb, var(--cream) 16%, transparent)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'color-mix(in srgb, var(--cream) 72%, transparent)' }}>Visitors today</p>
            <p className="mt-1.5 text-3xl md:text-4xl font-bold tracking-tight leading-none" style={{ color: 'var(--cream)' }}>{nf(data.todayVisitors)}</p>
            {yesterdayVisitors != null && (
              <p className="mt-2 text-xs" style={{ color: 'color-mix(in srgb, var(--cream) 60%, transparent)' }}>Yesterday: {nf(yesterdayVisitors)}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        {/* Visitor trend */}
        <div className="lg:col-span-2 admin-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-semibold text-lg text-zinc-900">Visitors</h2>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--maroon)' }} /> Daily unique visitors</span>
          </div>
          {data.series?.length ? (
            <ResponsiveContainer width="100%" height={272}>
              <AreaChart data={data.series} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="gVis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--maroon)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--maroon)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#00000008" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickFormatter={dLabel} minTickGap={28} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="visitors" stroke="var(--maroon)" fill="url(#gVis)" strokeWidth={2.2} name="Visitors" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-stone-400 py-20 text-sm">No visits yet. Browse the storefront to generate data.</p>
          )}
        </div>

        {/* Right column — audience breakdown */}
        <div className="flex flex-col gap-4 md:gap-6">
          {/* New vs returning */}
          <div className="admin-card p-4 md:p-5">
            <div className="flex items-center gap-2 mb-1">
              <Users size={17} className="text-zinc-400" />
              <h2 className="font-semibold text-lg text-zinc-900">New vs returning</h2>
            </div>
            <p className="text-xs text-zinc-400 mb-4">{totalVR ? `Of ${nf(totalVR)} visitors` : 'No visitors yet'}</p>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-zinc-100 mb-4">
              <div className="h-full" style={{ width: `${pctNew}%`, background: 'var(--maroon)' }} />
              <div className="h-full" style={{ width: `${pctRet}%`, background: 'var(--gold)' }} />
            </div>
            <div className="space-y-2.5">
              <SplitLegend color="var(--maroon)" label="New visitors" value={nf(data.newVisitors)} pct={pctNew} />
              <SplitLegend color="var(--gold)" label="Returning" value={nf(data.returningVisitors)} pct={pctRet} />
            </div>
          </div>

          {/* Devices */}
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
    </div>
  )
}

