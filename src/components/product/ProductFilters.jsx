import { SlidersHorizontal, X } from 'lucide-react'
import { CATEGORIES, METALS, STONES } from '../../data/mockData.js'

export function ProductFilters({ filters, onChange, onReset }) {
  const hasActive = filters.category !== 'All' || filters.metal !== 'All' || filters.stone !== 'All' || filters.inStockOnly

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-sm text-dark-900 dark:text-cream-50">
          <SlidersHorizontal size={16} className="text-gold-500" />
          Filters
        </div>
        {hasActive && (
          <button onClick={onReset} className="flex items-center gap-1 text-xs text-stone-400 hover:text-gold-500 transition-colors cursor-pointer">
            <X size={12} /> Reset
          </button>
        )}
      </div>

      <FilterGroup label="Category">
        {CATEGORIES.map(c => (
          <Pill key={c} active={filters.category === c} onClick={() => onChange('category', c)}>{c}</Pill>
        ))}
      </FilterGroup>

      <FilterGroup label="Metal">
        {METALS.map(m => (
          <Pill key={m} active={filters.metal === m} onClick={() => onChange('metal', m)}>
            {m === 'All' ? 'All' : m}
          </Pill>
        ))}
      </FilterGroup>

      <FilterGroup label="Stone">
        {STONES.map(s => (
          <Pill key={s} active={filters.stone === s} onClick={() => onChange('stone', s)}>{s}</Pill>
        ))}
      </FilterGroup>

      <FilterGroup label="Price Range">
        <div className="space-y-2 w-full">
          <input
            type="range" min={0} max={300000} step={5000}
            value={filters.maxPrice}
            onChange={e => onChange('maxPrice', +e.target.value)}
            className="w-full accent-gold-500 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-stone-400">
            <span>₹0</span>
            <span className="text-gold-500 font-medium">up to ₹{(filters.maxPrice/1000).toFixed(0)}k</span>
            <span>₹3L+</span>
          </div>
        </div>
      </FilterGroup>

      <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={e => onChange('inStockOnly', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 rounded-full bg-cream-200 dark:bg-stone-700 peer-checked:bg-gold-500 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
        </div>
        <span className="text-sm text-stone-600 dark:text-stone-300">In stock only</span>
      </label>
    </div>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold tracking-wide text-stone-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Pill({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer border
        ${active
          ? 'bg-dark-900 text-white border-dark-900 dark:bg-gold-500 dark:text-dark-950 dark:border-gold-500'
          : 'bg-white dark:bg-stone-900 border-cream-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-gold-400 hover:text-gold-600'
        }`}
    >
      {children}
    </button>
  )
}
