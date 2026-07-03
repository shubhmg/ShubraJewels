import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { ProductCard } from '../../components/product/ProductCard.jsx'
import { Mandala, Motif } from '../../components/decor/Decor.jsx'
import { Stagger, StaggerItem } from '../../components/motion/Motion.jsx'
import { Dropdown } from '../../components/ui/Dropdown.jsx'
import { useProducts, useCategories, useCollections } from '../../hooks/useApi.js'

const SORT_OPTIONS = [
  { value: 'featured',   label: 'Featured'        },
  { value: 'price-asc',  label: 'Price: Low–High' },
  { value: 'price-desc', label: 'Price: High–Low' },
  { value: 'rating',     label: 'Top Rated'       },
  { value: 'newest',     label: 'New Arrivals'    },
]

export function Products() {
  const [params, setParams] = useSearchParams()
  const { data: products, loading } = useProducts()
  const { data: categories } = useCategories()
  const { data: collections } = useCollections()

  const categoryParam = params.get('category') || 'all'
  const collectionParam = params.get('collection') || 'all'
  const under599 = params.get('under599') === '1'

  const [sort, setSort] = useState('featured')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [showFilter, setShowFilter] = useState(false)

  useEffect(() => { window.scrollTo(0, 0) }, [categoryParam, collectionParam, under599])

  const setParam = (key, val) => {
    const next = new URLSearchParams(params)
    if (!val || val === 'all') next.delete(key)
    else next.set(key, val)
    setParams(next, { replace: true })
  }

  const catId = useMemo(() => {
    if (categoryParam === 'all') return null
    const c = (categories || []).find((x) => x.slug === categoryParam || x._id === categoryParam)
    return c?._id || categoryParam
  }, [categoryParam, categories])

  const colId = useMemo(() => {
    if (collectionParam === 'all') return null
    const c = (collections || []).find((x) => x.slug === collectionParam || x._id === collectionParam)
    return c?._id || collectionParam
  }, [collectionParam, collections])

  const list = useMemo(() => {
    let res = [...(products || [])]
    if (catId) res = res.filter((p) => String(p.categoryId) === String(catId))
    if (colId) res = res.filter((p) => (p.collectionIds || []).map(String).includes(String(colId)))
    if (under599) res = res.filter((p) => p.price <= 599)
    if (inStockOnly) res = res.filter((p) => p.inStock !== false)
    switch (sort) {
      case 'price-asc':  res.sort((a, b) => a.price - b.price); break
      case 'price-desc': res.sort((a, b) => b.price - a.price); break
      case 'rating':     res.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0)); break
      case 'newest':     res.sort((a, b) => (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0)); break
      default: break
    }
    return res
  }, [products, catId, colId, under599, inStockOnly, sort])

  const activeCat = (categories || []).find((c) => c._id === catId)
  const activeCol = (collections || []).find((c) => c._id === colId)
  const title = activeCat?.name || activeCol?.name || (under599 ? 'Under ₹599' : 'All Jhumkas')
  const hindi = activeCat?.hindiName || activeCol?.hindiName || (under599 ? '₹599 से कम' : 'सभी झुमके')

  return (
    <div className="pt-16 min-h-dvh" style={{ background: 'var(--cream)' }}>
      <div className="relative overflow-hidden" style={{ background: 'var(--maroon)' }}>
        <Mandala size={360} className="absolute -right-24 -top-16 opacity-20" />
        <div className="container-wide py-14 relative text-center">
          <div className="eyebrow justify-center flex"><Motif size={18} />Browse the collection</div>
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

        <div className="flex gap-8">
          <aside className={`flex-shrink-0 transition-all duration-300 overflow-hidden ${showFilter ? 'w-64 opacity-100' : 'w-0 opacity-0'}`}>
            <div className="w-64 pr-2">
              <div className="sticky top-24 space-y-6">
                <FilterGroup title="Category">
                  <Chip active={categoryParam === 'all' && !under599} onClick={() => { setParam('category', 'all'); setParam('under599', '') }}>All</Chip>
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
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <X size={28} className="text-stone-300 mb-3" />
                <p className="font-display text-xl" style={{ color: 'var(--ink)' }}>No jhumkas found</p>
                <p className="text-stone-400 text-sm mt-1">Try a different filter.</p>
              </div>
            ) : (
              <Stagger className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6" gap={0.05}>
                {list.map((p) => <StaggerItem key={p.id}><ProductCard product={p} /></StaggerItem>)}
              </Stagger>
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
