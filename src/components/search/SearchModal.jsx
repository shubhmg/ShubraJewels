import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Search, X, TrendingUp } from 'lucide-react'
import { useProducts } from '../../hooks/useApi.js'

const TRENDING = ['Oxidised', 'Meenakari', 'Bridal', 'Under 599']

export function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const { data: products } = useProducts()

  const q = query.trim().toLowerCase()
  const results = q.length > 1
    ? (products || []).filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.hindiName || '').toLowerCase().includes(q) ||
        (p.material || '').toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q))
      ).slice(0, 6)
    : []

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 100)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!isOpen) return null

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" role="dialog" aria-modal="true" aria-label="Search">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-dark-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-stone-950 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-200 dark:border-stone-800">
          <Search size={18} className="text-stone-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search jewellery, collections, stones…"
            className="flex-1 bg-transparent text-dark-900 dark:text-cream-50 placeholder-stone-400 text-base outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-stone-400 hover:text-dark-900 dark:hover:text-cream-50 transition-colors cursor-pointer" aria-label="Clear search">
              <X size={16} />
            </button>
          )}
          <button onClick={onClose} className="text-xs text-stone-400 hover:text-dark-900 dark:hover:text-cream-50 transition-colors cursor-pointer border border-cream-200 dark:border-stone-700 rounded-lg px-2 py-1">
            Esc
          </button>
        </div>

        {/* Results / Trending */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {results.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wide text-stone-400 px-2 mb-3">Results</p>
              {results.map(p => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}`}
                  onClick={onClose}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-cream-50 dark:hover:bg-stone-800 transition-colors group"
                >
                  <img src={p.images[0]} alt={p.name} className="w-12 h-14 object-cover rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-stone-400 tracking-wide">{p.hindiName || p.material || 'Jhumka'}</p>
                    <p className="font-serif font-medium text-dark-900 dark:text-cream-100 truncate">{p.name}</p>
                    <p className="text-sm text-gold-600 dark:text-gold-400 font-medium mt-0.5">{fmt(p.price)}</p>
                  </div>
                  <div className="text-xs text-stone-300 group-hover:text-gold-500 transition-colors">→</div>
                </Link>
              ))}
            </div>
          ) : query.trim().length > 1 ? (
            <div className="text-center py-8">
              <p className="text-stone-400">No results for "<span className="text-dark-900 dark:text-cream-100">{query}</span>"</p>
              <p className="text-sm text-stone-300 mt-1">Try a different term</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-wide text-stone-400 px-2">Trending Searches</p>
              {TRENDING.map(t => (
                <button key={t} onClick={() => setQuery(t)} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-cream-50 dark:hover:bg-stone-800 transition-colors text-left cursor-pointer group">
                  <TrendingUp size={14} className="text-gold-400" />
                  <span className="text-sm text-stone-600 dark:text-stone-300 group-hover:text-dark-900 dark:group-hover:text-cream-50 transition-colors">{t}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
