import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { REVENUE_DATA, TOP_PRODUCTS } from '../../data/mockData.js'
import { TrendingUp, IndianRupee, ShoppingCart, Users } from 'lucide-react'

const fmt     = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
const fmtComp = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, notation: 'compact' }).format(n)

const CATEGORY_DATA = [
  { name: 'Rings',     value: 38, color: '#C9A84C' },
  { name: 'Necklaces', value: 25, color: '#E3C97A' },
  { name: 'Earrings',  value: 20, color: '#A16207' },
  { name: 'Bracelets', value: 12, color: '#78350F' },
  { name: 'Other',     value: 5,  color: '#57534E' },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-900 border border-stone-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-stone-400 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white capitalize">{p.name}: </span>
          <span className="text-gold-400 font-medium">
            {p.name === 'revenue' ? fmt(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

const totalRevenue = REVENUE_DATA.reduce((a, d) => a + d.revenue, 0)
const totalOrders  = REVENUE_DATA.reduce((a, d) => a + d.orders, 0)

export function AdminReports() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-semibold text-2xl text-dark-900 dark:text-cream-50">Sales Reports</h1>
        <p className="text-sm text-stone-400 mt-0.5">Nov 2025 – May 2026 overview</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: IndianRupee, label: 'Total Revenue',   value: fmt(totalRevenue),   sub: '7-month period'    },
          { icon: ShoppingCart,label: 'Total Orders',    value: totalOrders,          sub: '7-month period'    },
          { icon: TrendingUp,  label: 'Best Month',      value: 'May 2026',           sub: fmt(1890000)        },
          { icon: Users,       label: 'Repeat Customers',value: '68%',                sub: 'of all buyers'     },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bento-item">
            <Icon size={16} className="text-gold-500 mb-3" />
            <p className="font-semibold text-2xl font-bold text-dark-900 dark:text-cream-50">{value}</p>
            <p className="text-xs text-stone-400 mt-1">{label}</p>
            <p className="text-xs text-stone-500 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue trend */}
      <div className="bento-item">
        <h2 className="font-semibold text-lg text-dark-900 dark:text-cream-50 mb-5">Revenue Trend</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={REVENUE_DATA} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" name="revenue" stroke="#C9A84C" strokeWidth={2.5} fill="url(#rev2)" dot={{ fill: '#C9A84C', r: 4, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Orders bar */}
        <div className="bento-item">
          <h2 className="font-semibold text-lg text-dark-900 dark:text-cream-50 mb-5">Monthly Orders</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={REVENUE_DATA} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="orders" name="orders" fill="#C9A84C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="bento-item">
          <h2 className="font-semibold text-lg text-dark-900 dark:text-cream-50 mb-5">Sales by Category</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={CATEGORY_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {CATEGORY_DATA.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#1C1917', border: '1px solid #44403C', borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {CATEGORY_DATA.map(d => (
                <div key={d.name} className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-xs text-stone-500 flex-1">{d.name}</span>
                  <span className="text-xs font-semibold text-dark-900 dark:text-cream-100">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top products table */}
      <div className="bento-item">
        <h2 className="font-semibold text-lg text-dark-900 dark:text-cream-50 mb-4">Top Performing Products</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]" aria-label="Top products table">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-wider border-b border-cream-100 dark:border-stone-800">
                <th className="pb-2 text-left font-medium">Rank</th>
                <th className="pb-2 text-left font-medium">Product</th>
                <th className="pb-2 text-right font-medium">Units</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
                <th className="pb-2 text-right font-medium">vs Last Month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 dark:divide-stone-800">
              {TOP_PRODUCTS.map((p, i) => (
                <tr key={p.name}>
                  <td className="py-3 pr-4">
                    <span className="w-6 h-6 rounded-full bg-gold-500/20 text-gold-500 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  </td>
                  <td className="py-3 text-sm font-medium text-dark-900 dark:text-cream-100">{p.name}</td>
                  <td className="py-3 text-right text-sm text-stone-500">{p.units}</td>
                  <td className="py-3 text-right text-sm font-semibold text-dark-900 dark:text-cream-100">{fmt(p.revenue)}</td>
                  <td className="py-3 text-right">
                    <span className={`text-xs font-semibold ${p.trend.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>{p.trend}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
