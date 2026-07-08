import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { ProductCard } from '../../components/product/ProductCard.jsx'
import { Mandala, Motif } from '../../components/decor/Decor.jsx'
import { Dropdown } from '../../components/ui/Dropdown.jsx'
import { useProducts, useCategories, useCollections } from '../../hooks/useApi.js'
import { useSettings } from '../../lib/SettingsProvider.jsx'
import { resolveContent } from '../../lib/siteContent.js'

const SORT_OPTIONS = [
  { value: 'featured',   label: 'Featured'        },
  { value: 'price-asc',  label: 'Price: Low–High' },
  { value: 'price-desc', label: 'Price: High–Low' },
  { value: 'rating',     label: 'Top Rated'       },
  { value: 'newest',     label: 'New Arrivals'    },
]

export function Products() {
  const [params, setParams] = useSearchParams()
  const { data: categories } = useCategories()
  const { data: collections } = useCollections()

  const categoryParam = params.get('category') || 'all'
  const collectionParam = params.get('collection') || 'all'
  const under599 = params.get('under599') === '1'

  // Let the SERVER filter (it resolves slug-or-id, under599 and collection
  // correctly) — the client only sorts + hides out-of-stock. This avoids the
  // id-resolution race that showed an empty grid before categories loaded.
  const query = useMemo(() => {
    const q = new URLSearchParams()
    if (categoryParam !== 'all') q.set('category', categoryParam)
    if (collectionParam !== 'all') q.set('collection', collectionParam)
    if (under599) q.set('under599', '1')
    const s = q.toString()
    return s ? `?${s}` : ''
  }, [categoryParam, collectionParam, under599])

  const { data: products, loading } = useProducts(query)

  const [sort, setSort] = useState('featured')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [showFilter, setShowFilter] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)

  // Scroll to top only when the filter actually CHANGES — not on mount, so
  // returning here via the back button keeps the previous scroll position.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    window.scrollTo(0, 0)
  }, [categoryParam, collectionParam, under599])

  // Apply several param changes atomically. Doing sequential setParam() calls
  // races: each clones the same stale `params`, so only the last write survives.
  const patchParams = (updates) => {
    const next = new URLSearchParams(params)
    for (const [key, val] of Object.entries(updates)) {
      if (!val || val === 'all') next.delete(key)
      else next.set(key, val)
    }
    setParams(next, { replace: true })
  }
  const setParam = (key, val) => patchParams({ [key]: val })

  const list = useMemo(() => {
    let res = [...(products || [])]
    if (inStockOnly) res = res.filter((p) => p.inStock !== false)
    switch (sort) {
      case 'price-asc':  res.sort((a, b) => a.price - b.price); break
      case 'price-desc': res.sort((a, b) => b.price - a.price); break
      case 'rating':     res.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0)); break
      case 'newest':     res.sort((a, b) => (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0)); break
      default: break
    }
    return res
  }, [products, inStockOnly, sort])

  const settings = useSettings()
  const pc = resolveContent(settings.content).pages.products
  const activeCat = (categories || []).find((c) => c.slug === categoryParam || c._id === categoryParam)
  const activeCol = (collections || []).find((c) => c.slug === collectionParam || c._id === collectionParam)
  const title = activeCat?.name || activeCol?.name || (under599 ? pc.titleUnder599 : pc.titleAll)
  const hindi = activeCat?.hindiName || activeCol?.hindiName || (under599 ? pc.hindiUnder599 : pc.hindiAll)

  return (
    <div className="min-h-dvh" style={{ background: 'var(--cream)' }}>
      <div className="relative overflow-hidden" style={{ background: 'var(--maroon-dark)' }}>
        <Mandala size={300} className="hidden md:block absolute right-0 md:right-8 top-16 md:top-24 opacity-15 pointer-events-none" />
        <div className="container-wide pt-24 md:pt-32 pb-12 md:pb-14 relative text-center">
          <div className="eyebrow justify-center flex"><Motif size={18} />{pc.eyebrow}</div>
          <p className="font-hindi text-[var(--gold-light)] text-lg mt-2">{hindi}</p>
          <h1 className="font-display text-white text-4xl md:text-5xl">{title}</h1>
        </div>
      </div>

      <div className="container-wide py-8">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilter((f) => !f)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors cursor-pointer"
              style={{ borderColor: 'color-mix(in srgb, var(--gold) 40%, transparent)', color: 'var(--ink)' }}
            >
              <SlidersHorizontal size={14} /> Filters
            </button>
            <span className="text-sm text-stone-500">{loading ? '…' : `${list.length} items`}</span>
          </div>
          <Dropdown value={sort} onChange={setSort} options={SORT_OPTIONS} />
        </div>

        <div className="md:flex md:gap-8">
          {/* Filters — full-width panel on mobile, sticky sidebar on desktop */}
          {showFilter && (
            <aside className="md:w-64 md:flex-shrink-0 mb-6 md:mb-0">
              <div className="md:sticky md:top-24 space-y-5 rounded-2xl md:rounded-none bg-white md:bg-transparent p-4 md:p-0 shadow-card md:shadow-none">
                <div className="flex items-center justify-between md:hidden">
                  <span className="font-display text-lg" style={{ color: 'var(--ink)' }}>Filters</span>
                  <button onClick={() => setShowFilter(false)} className="text-stone-400 cursor-pointer"><X size={18} /></button>
                </div>
                <FilterGroup title="Category">
                  <Chip active={categoryParam === 'all' && !under599} onClick={() => patchParams({ category: 'all', under599: '' })}>All</Chip>
                  {(categories || []).map((c) => (
                    <Chip key={c._id} active={c.slug === categoryParam || c._id === categoryParam} onClick={() => setParam('category', c.slug || c._id)}>{c.name}</Chip>
                  ))}
                </FilterGroup>
                {collections?.length > 0 && (
                  <FilterGroup title="Royal Collection">
                    <Chip active={collectionParam === 'all'} onClick={() => setParam('collection', 'all')}>All</Chip>
                    {collections.map((c) => (
                      <Chip key={c._id} active={c.slug === collectionParam || c._id === collectionParam} onClick={() => setParam('collection', c.slug || c._id)}>{c.name}</Chip>
                    ))}
                  </FilterGroup>
                )}
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--ink)' }}>
                  <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="accent-[var(--maroon)]" />
                  In stock only
                </label>
              </div>
            </aside>
          )}

          <div className="flex-1 min-w-0">
            {loading && list.length === 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 md:gap-6" style={{ display: 'grid' }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'color-mix(in srgb, var(--beige) 40%, white)' }}>
                    <div className="aspect-[3/4]" style={{ background: 'color-mix(in srgb, var(--beige) 70%, white)' }} />
                    <div className="p-3 space-y-2">
                      <div className="h-3 rounded" style={{ background: 'color-mix(in srgb, var(--beige) 70%, white)' }} />
                      <div className="h-3 w-1/2 rounded" style={{ background: 'color-mix(in srgb, var(--beige) 70%, white)' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <X size={28} className="text-stone-300 mb-3" />
                <p className="font-display text-xl" style={{ color: 'var(--ink)' }}>No jhumkas found</p>
                <p className="text-stone-400 text-sm mt-1">Try a different filter.</p>
              </div>
            ) : (
              // Plain CSS grid — row-major, equal-height cells. Inline display:grid
              // guarantees it regardless of any utility-class ordering. No motion
              // wrappers here: they were injecting transformed divs between the grid
              // and the cards, breaking the row layout on mobile.
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 md:gap-6" style={{ display: 'grid' }}>
                {list.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--maroon)' }}>{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border"
      style={
        active
          ? { background: 'var(--maroon)', color: 'var(--cream)', borderColor: 'var(--maroon)' }
          : { background: 'white', color: 'var(--ink)', borderColor: 'color-mix(in srgb, var(--gold) 35%, transparent)' }
      }
    >
      {children}
    </button>
  )
}
