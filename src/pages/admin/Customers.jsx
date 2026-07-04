import { useState } from 'react'
import { Search, Users } from 'lucide-react'
import { CUSTOMERS } from '../../data/mockData.js'
import { Badge } from '../../components/ui/Badge.jsx'

const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export function AdminCustomers() {
  const [search, setSearch] = useState('')

  const filtered = CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  const tierVariant = (t) => t === 'Platinum' ? 'platinum' : t === 'Gold' ? 'gold' : t === 'Silver' ? 'silver' : 'bronze'

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl text-dark-900 dark:text-cream-50">Customers</h1>
          <p className="text-sm text-stone-400 mt-0.5">{CUSTOMERS.length} registered customers</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: CUSTOMERS.length },
          { label: 'Platinum Tier', value: CUSTOMERS.filter(c => c.tier === 'Platinum').length },
          { label: 'Avg. Orders',   value: (CUSTOMERS.reduce((a, c) => a + c.orders, 0) / CUSTOMERS.length).toFixed(1) },
          { label: 'Avg. LTV',      value: fmt(CUSTOMERS.reduce((a, c) => a + c.totalSpend, 0) / CUSTOMERS.length) },
        ].map(({ label, value }) => (
          <div key={label} className="bento-item text-center">
            <p className="font-semibold text-2xl font-bold text-dark-900 dark:text-cream-50">{value}</p>
            <p className="text-xs text-stone-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search customers…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[color-mix(in_srgb,var(--gold)_18%,transparent)] bg-white dark:bg-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 transition-all"
          aria-label="Search customers"
        />
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]" aria-label="Customers table">
            <thead className="bg-cream-50 dark:bg-stone-800/50 border-b border-cream-200 dark:border-stone-700">
              <tr className="text-xs text-stone-400 uppercase tracking-wider">
                <th className="px-5 py-3 text-left font-semibold">Customer</th>
                <th className="px-5 py-3 text-left font-semibold">Joined</th>
                <th className="px-5 py-3 text-center font-semibold">Orders</th>
                <th className="px-5 py-3 text-right font-semibold">Total Spend</th>
                <th className="px-5 py-3 text-center font-semibold">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 dark:divide-stone-800">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-cream-50 dark:hover:bg-stone-800/40 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-gold-600 dark:text-gold-400 font-semibold text-sm">{c.name[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-dark-900 dark:text-cream-100">{c.name}</p>
                        <p className="text-xs text-stone-400">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-stone-500">{new Date(c.joined).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-5 py-3 text-center text-sm font-medium text-dark-900 dark:text-cream-100">{c.orders}</td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-dark-900 dark:text-cream-100">{fmt(c.totalSpend)}</td>
                  <td className="px-5 py-3 text-center">
                    <Badge variant={tierVariant(c.tier)}>{c.tier}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <Users size={32} className="text-stone-300" />
            <p className="text-stone-400">No customers found</p>
          </div>
        )}
      </div>
    </div>
  )
}
