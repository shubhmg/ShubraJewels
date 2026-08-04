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
  // How many filters differ from the defaults — drives the badge on the pill
  // and the "Clear all" affordance.
  const activeCount = (categoryParam !== 'all' ? 1 : 0) + (collectionParam !== 'all' ? 1 : 0) + (under599 ? 1 : 0) + (inStockOnly ? 1 : 0)

  // MOBILE sheet stages its selections in a DRAFT — nothing applies until the
  // "Show N pieces" button. Desktop's sidebar stays instant (draft === null).
  const [draft, setDraft] = useState(null)
  const openFilters = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setDraft({ category: categoryParam, collection: collectionParam, under599, inStock: inStockOnly })
    }
    setShowFilter(true)
  }
  const closeFilters = () => { setShowFilter(false); setDraft(null) } // discard staged changes
  const applyDraft = () => {
    if (draft) {
      patchParams({ category: draft.category, collection: draft.collection, under599: draft.under599 ? '1' : '' })
      setInStockOnly(draft.inStock)
    }
    setShowFilter(false)
    setDraft(null)
  }

  // Live count for the STAGED selection — fetched only while the sheet is open
  // (null = no request). Uses useProducts (same transform + cache key as the
  // grid) so pressing "Show" re-uses THIS response: no second API call, no
  // skeleton flash — the grid renders instantly from the fresh cache.
  const draftQuery = useMemo(() => {
    if (!draft) return null
    const q = new URLSearchParams()
    if (draft.category !== 'all') q.set('category', draft.category)
    if (draft.collection !== 'all') q.set('collection', draft.collection)
    if (draft.under599) q.set('under599', '1')
    const s = q.toString()
    return s ? `?${s}` : ''
  }, [draft])
  const { data: draftProducts, loading: draftLoading } = useProducts(draftQuery)
  const draftCount = draft ? (draftProducts || []).filter((p) => !draft.inStock || p.inStock !== false).length : 0

  // Lock the page behind the mobile filter sheet (desktop sidebar must NOT lock).
  useEffect(() => {
    if (!showFilter || window.innerWidth >= 768) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [showFilter])

  const pc = resolveContent(settings.content).pages.products
  const activeCat = (categories || []).find((c) => c.slug === categoryParam || c._id === categoryParam)
  const activeCol = (collections || []).find((c) => c.slug === collectionParam || c._id === collectionParam)
  const title = activeCat?.name || activeCol?.name || (under599 ? pc.titleUnder599 : pc.titleAll)
  const hindi = activeCat?.hindiName || activeCol?.hindiName || (under599 ? pc.hindiUnder599 : pc.hindiAll)

  return (
    // ~5% ink mixed into the cream so the near-white product cards separate from the page
    <div className="min-h-dvh" style={{ background: 'color-mix(in srgb, var(--cream) 95%, var(--ink))' }}>
      <div className="relative overflow-hidden" style={{ background: 'var(--maroon-dark)' }}>
        <Mandala size={300} className="hidden md:block absolute right-0 md:right-8 top-16 md:top-24 opacity-15 pointer-events-none" />
        <div className="container-wide pt-24 md:pt-32 pb-12 md:pb-14 relative text-center">
          <div className="eyebrow justify-center flex"><Motif size={18} />{pc.eyebrow}</div>
          <p className="font-hindi text-[var(--gold-light)] text-lg mt-2">{hindi}</p>
          <h1 className="font-display text-white text-4xl md:text-5xl">{title}</h1>
          {/* Item count lives HERE (not squeezed into the toolbar) — nbsp keeps the
              line height stable while loading so the hero never jumps. */}
          <p className="text-[11px] uppercase tracking-[0.2em] mt-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {loading ? ' ' : `${list.length} piece${list.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <div className="container-wide py-8">
        {/* Toolbar: two MATCHING white pills — half-width each on mobile (nothing
            can wrap or truncate), natural widths on desktop. The Filters pill
            flips to maroon while the panel is open so its state is visible. */}
        <div className="grid grid-cols-2 gap-2.5 md:flex md:items-center md:justify-between mb-6">
          <button
            onClick={() => (showFilter ? closeFilters() : openFilters())}
            className="flex items-center justify-center md:justify-start gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer active:scale-[0.98]"
            style={showFilter
              ? { background: 'var(--maroon)', color: '#fff', boxShadow: '0 10px 28px -12px color-mix(in srgb, var(--maroon) 60%, transparent)' }
              : { background: '#fff', color: 'var(--ink)', boxShadow: '0 1px 2px rgba(40,20,15,0.06), 0 10px 28px -14px color-mix(in srgb, var(--maroon) 45%, transparent)' }}
          >
            <SlidersHorizontal size={14} style={showFilter ? undefined : { color: 'var(--maroon)' }} /> Filters
            {activeCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center" style={{ background: showFilter ? 'rgba(255,255,255,0.25)' : 'var(--maroon)', color: '#fff' }}>{activeCount}</span>
            )}
          </button>
          <Dropdown value={sort} onChange={setSort} options={SORT_OPTIONS} variant="modern" prefixLabel="Sort" className="md:w-auto md:min-w-[12rem]" />
        </div>

        {(() => {
          // Shared filter body. The sheet (mobile) works on the DRAFT — nothing
          // applies until "Show"; the sidebar (desktop, draft === null) applies
          // instantly as before.
          const cur = draft || { category: categoryParam, collection: collectionParam, under599, inStock: inStockOnly }
          const pick = (patch) => {
            if (draft) { setDraft((d) => ({ ...d, ...patch })); return }
            if ('inStock' in patch) setInStockOnly(patch.inStock)
            const q = {}
            if ('category' in patch) q.category = patch.category
            if ('collection' in patch) q.collection = patch.collection
            if ('under599' in patch) q.under599 = patch.under599 ? '1' : ''
            if (Object.keys(q).length) patchParams(q)
          }
          const filterContent = (
            <>
              <FilterGroup title="Category">
                <Chip active={cur.category === 'all' && !cur.under599} onClick={() => pick({ category: 'all', under599: false })}>All</Chip>
                {(categories || []).map((c) => (
                  <Chip key={c._id} active={c.slug === cur.category || c._id === cur.category} onClick={() => pick({ category: c.slug || c._id })}>{c.name}</Chip>
                ))}
              </FilterGroup>
              {collections?.length > 0 && (
                <FilterGroup title="Royal Collection">
                  <Chip active={cur.collection === 'all'} onClick={() => pick({ collection: 'all' })}>All</Chip>
                  {collections.map((c) => (
                    <Chip key={c._id} active={c.slug === cur.collection || c._id === cur.collection} onClick={() => pick({ collection: c.slug || c._id })}>{c.name}</Chip>
                  ))}
                </FilterGroup>
              )}
              <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer" style={{ color: 'var(--ink)' }}>
                <input type="checkbox" checked={cur.inStock} onChange={(e) => pick({ inStock: e.target.checked })} className="w-4 h-4 accent-[var(--maroon)]" />
                In stock only
              </label>
            </>
          )
          return (
        <div className="md:flex md:gap-8">
          {/* Desktop — sticky sidebar (unchanged pattern, shared content) */}
          {showFilter && (
            <aside className="hidden md:block md:w-64 md:flex-shrink-0">
              <div className="md:sticky md:top-24 space-y-5">{filterContent}</div>
            </aside>
          )}

          {/* Mobile — bottom sheet: backdrop, drag handle, Clear all, live-count CTA */}
          {showFilter && (
            <div className="md:hidden fixed inset-0 z-[90]">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeFilters} />
              <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl animate-slide-up flex flex-col max-h-[82dvh]">
                <div className="pt-3 grid place-items-center"><span className="w-10 h-1 rounded-full bg-stone-200" /></div>
                <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b" style={{ borderColor: 'color-mix(in srgb, var(--gold) 20%, transparent)' }}>
                  <span className="font-display text-xl" style={{ color: 'var(--ink)' }}>Filters</span>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setDraft({ category: 'all', collection: 'all', under599: false, inStock: false })} className="text-xs font-semibold cursor-pointer" style={{ color: 'var(--maroon)' }}>Clear all</button>
                    <button onClick={closeFilters} className="w-8 h-8 grid place-items-center rounded-full text-stone-400 hover:bg-stone-100 cursor-pointer" aria-label="Close filters"><X size={18} /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">{filterContent}</div>
                <div className="px-5 pt-3 border-t" style={{ borderColor: 'color-mix(in srgb, var(--gold) 20%, transparent)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
                  <button
                    onClick={applyDraft}
                    className="w-full py-3.5 rounded-full text-sm font-bold text-white cursor-pointer transition-all active:scale-[0.99]"
                    style={{ background: 'var(--maroon)', boxShadow: '0 12px 30px -12px color-mix(in srgb, var(--maroon) 70%, transparent)' }}
                  >
                    {draftLoading ? 'Show …' : `Show ${draftCount} piece${draftCount === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {loading && list.length === 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 md:gap-6" style={{ display: 'grid' }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'color-mix(in srgb, var(--beige) 40%, white)' }}>
                    <div className="aspect-[4/5]" style={{ background: 'color-mix(in srgb, var(--beige) 70%, white)' }} />
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
          )
        })()}
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
      className="px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer active:scale-[0.97]"
      style={
        active
          ? { background: 'var(--maroon)', color: 'var(--cream)', boxShadow: '0 6px 16px -8px color-mix(in srgb, var(--maroon) 60%, transparent)' }
          : { background: 'color-mix(in srgb, var(--gold) 16%, white)', color: 'var(--ink)' }
      }
    >
      {children}
    </button>
  )
}
