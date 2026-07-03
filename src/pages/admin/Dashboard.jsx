import { useEffect, useState } from 'react'
import { Eye, Users, ShoppingCart, IndianRupee, Loader2, TrendingUp } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { api } from '../../lib/api.js'
import { AdminHeader } from '../../components/admin/AdminUI.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)

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

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold-500" /></div>

  const kpis = [
    { icon: Eye, label: 'Page views', value: data.totalViews, tint: 'text-blue-500 bg-blue-50' },
    { icon: Users, label: 'Unique visitors', value: data.uniqueSessions, tint: 'text-violet-500 bg-violet-50' },
    { icon: ShoppingCart, label: 'Orders', value: data.orders, tint: 'text-emerald-500 bg-emerald-50' },
    { icon: IndianRupee, label: 'Revenue', value: fmt(data.revenue), tint: 'text-gold-600 bg-gold-500/10' },
  ]

  return (
    <div>
      <AdminHeader title="Dashboard" subtitle={`Last ${days} days · ${data.todayViews} views today`}>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm cursor-pointer">
          {[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </AdminHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(({ icon: Icon, label, value, tint }) => (
          <div key={label} className="bg-white dark:bg-stone-900 rounded-2xl border border-cream-200 dark:border-stone-800 p-5">
            <div className={`w-10 h-10 rounded-xl grid place-items-center mb-3 ${tint}`}><Icon size={18} /></div>
            <p className="text-2xl font-bold text-dark-900 dark:text-cream-50">{value}</p>
            <p className="text-xs text-stone-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Visitors chart */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-2xl border border-cream-200 dark:border-stone-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-gold-500" />
            <h2 className="font-serif text-lg text-dark-900 dark:text-cream-50">Visitors</h2>
          </div>
          {data.series?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.series}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--maroon)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--maroon)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d) => d?.slice(5)} minTickGap={24} />
                <Tooltip />
                <Area type="monotone" dataKey="visitors" stroke="var(--maroon)" fill="url(#g)" strokeWidth={2} name="Visitors" />
                <Area type="monotone" dataKey="views" stroke="var(--gold)" fill="transparent" strokeWidth={1.5} name="Views" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-stone-400 py-16 text-sm">No visits yet. Browse the storefront to generate data.</p>
          )}
        </div>

        {/* Top pages */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-cream-200 dark:border-stone-800 p-5">
          <h2 className="font-serif text-lg text-dark-900 dark:text-cream-50 mb-4">Top Pages</h2>
          <div className="space-y-2">
            {(data.topPages || []).map((p) => (
              <div key={p.path} className="flex items-center justify-between text-sm">
                <span className="truncate text-stone-600 dark:text-stone-300">{p.path}</span>
                <span className="font-semibold text-dark-900 dark:text-cream-50">{p.views}</span>
              </div>
            ))}
            {!data.topPages?.length && <p className="text-stone-400 text-sm">No data yet.</p>}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-cream-200 dark:border-stone-800 p-5 mt-6">
        <h2 className="font-serif text-lg text-dark-900 dark:text-cream-50 mb-4">Recent Orders</h2>
        {orders.length ? (
          <div className="divide-y divide-cream-100 dark:divide-stone-800">
            {orders.map((o) => (
              <div key={o._id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="font-medium text-dark-900 dark:text-cream-50">{o.orderNo}</span>
                <span className="text-stone-400">{o.customer?.name}</span>
                <span className="ml-auto font-semibold">{fmt(o.total)}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500">{o.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-stone-400 text-sm">No orders yet.</p>
        )}
      </div>
    </div>
  )
}
