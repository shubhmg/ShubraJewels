import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heart, ShoppingBag, Truck, Gift, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useCartStore } from '../../store/cartStore.js'
import { useWishlistStore } from '../../store/wishlistStore.js'
import { Badge } from '../../components/ui/Badge.jsx'
import { StarRating } from '../../components/ui/StarRating.jsx'
import { ProductCard } from '../../components/product/ProductCard.jsx'
import { useProduct, useProducts } from '../../hooks/useApi.js'
import { useSettings } from '../../lib/SettingsProvider.jsx'
import { resolveContent } from '../../lib/siteContent.js'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)

export function ProductDetail() {
  const { id } = useParams()
  const { data: product, loading } = useProduct(id)
  const { data: allProducts } = useProducts()
  const settings = useSettings()
  const pc = resolveContent(settings.content).product

  const [imgIdx, setImgIdx] = useState(0)
  const [adding, setAdding] = useState(false)
  const scroller = useRef(null)
  const { addItem, openCart } = useCartStore()
  const { toggle, has } = useWishlistStore()

  useEffect(() => { setImgIdx(0); window.scrollTo(0, 0); if (scroller.current) scroller.current.scrollLeft = 0 }, [id])

  if (loading) return <div className="pt-32 pb-40 text-center text-stone-400" style={{ background: 'var(--cream)' }}>Loading…</div>
  if (!product) return (
    <div className="pt-32 pb-40 text-center" style={{ background: 'var(--cream)' }}>
      <p className="font-display text-2xl" style={{ color: 'var(--ink)' }}>Jhumka not found</p>
      <Link to="/products" className="btn-outline-gold mt-6 inline-flex">Back to all jhumkas</Link>
    </div>
  )

  const pid = product.id || product._id
  const images = product.images?.length ? product.images : ['https://via.placeholder.com/800']
  const wishlisted = has(pid)
  const inStock = product.inStock !== false
  const discount = product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0

  const related = (allProducts || [])
    .filter((p) => p.id !== pid && String(p.categoryId) === String(product.categoryId))
    .slice(0, 4)

  const specs = [
    { label: 'Material', value: product.material },
    { label: 'Weight', value: product.weight },
  ].filter((x) => x.value)

  const goTo = (i) => {
    const n = (i + images.length) % images.length
    const el = scroller.current
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
    setImgIdx(n)
  }
  const onScroll = () => {
    const el = scroller.current
    if (el) setImgIdx(Math.round(el.scrollLeft / el.clientWidth))
  }

  const handleAddToCart = () => {
    if (!inStock || adding) return
    setAdding(true)
    addItem({ ...product, id: pid }, 'One Size')
    setTimeout(() => { setAdding(false); openCart() }, 700)
  }

  return (
    <div className="min-h-dvh animate-fade-in pb-24 md:pb-16" style={{ background: 'var(--cream)' }}>
      {/* Breadcrumb — desktop only */}
      <div className="hidden md:block container-wide pt-24 pb-3">
        <nav className="flex items-center gap-1.5 text-xs text-stone-400">
          <Link to="/" className="hover:text-[var(--maroon)]">Home</Link><span>/</span>
          <Link to="/products" className="hover:text-[var(--maroon)]">Jhumkas</Link><span>/</span>
          <span style={{ color: 'var(--ink)' }}>{product.name}</span>
        </nav>
      </div>

      <div className="md:container-wide md:pb-16">
        <div className="lg:grid lg:grid-cols-2 lg:gap-14">
          {/* ── Gallery ─────────────────────────────────────────── */}
          <div className="pt-14 lg:pt-0 lg:sticky lg:top-24 self-start">
            {/* Full-bleed swipe carousel */}
            <div className="relative">
              <div
                ref={scroller}
                onScroll={onScroll}
                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar md:rounded-3xl md:overflow-hidden"
                style={{ scrollBehavior: 'smooth' }}
              >
                {images.map((img, i) => (
                  <div key={i} className="snap-center shrink-0 w-full aspect-[4/5] md:aspect-square" style={{ background: 'var(--beige)' }}>
                    <img src={img} alt={product.name} className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
                  </div>
                ))}
              </div>

              {/* Wishlist (floats over image) */}
              <button onClick={() => toggle({ ...product, id: pid })} className="absolute right-3 top-3 w-9 h-9 grid place-items-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm cursor-pointer" aria-label="Wishlist">
                <Heart size={17} className={wishlisted ? 'fill-rose-500 text-rose-500' : 'text-stone-500'} />
              </button>

              {/* Desktop arrows */}
              {images.length > 1 && (
                <div className="hidden md:block">
                  <button onClick={() => goTo(imgIdx - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm grid place-items-center shadow-sm cursor-pointer" aria-label="Previous"><ChevronLeft size={16} /></button>
                  <button onClick={() => goTo(imgIdx + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm grid place-items-center shadow-sm cursor-pointer" aria-label="Next"><ChevronRight size={16} /></button>
                </div>
              )}

              {/* Dots (mobile) — lifted above the overlapping info sheet */}
              {images.length > 1 && (
                <div className="md:hidden absolute inset-x-0 bottom-7 flex justify-center gap-1.5">
                  {images.map((_, i) => (
                    <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === imgIdx ? 18 : 6, background: i === imgIdx ? 'var(--gold)' : 'rgba(255,255,255,0.7)' }} />
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnails (desktop) */}
            {images.length > 1 && (
              <div className="hidden md:flex gap-2 mt-3">
                {images.map((img, i) => (
                  <button key={i} onClick={() => goTo(i)} className="w-16 h-16 rounded-xl overflow-hidden ring-2 transition-all cursor-pointer" style={{ '--tw-ring-color': i === imgIdx ? 'var(--gold)' : 'transparent', opacity: i === imgIdx ? 1 : 0.55 }}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Info sheet ───────────────────────────────────────── */}
          <div className="relative -mt-5 lg:mt-0 rounded-t-[1.75rem] lg:rounded-none px-4 pt-6 lg:px-0 lg:pt-0 space-y-5" style={{ background: 'var(--cream)' }}>
            <div>
              {(product.isNewArrival || product.isBestseller || !inStock) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {product.isNewArrival && <Badge variant="new">New</Badge>}
                  {product.isBestseller && <Badge variant="bestseller">Bestseller</Badge>}
                  {!inStock && <Badge variant="soldout">{pc.soldOut}</Badge>}
                </div>
              )}
              {product.hindiName && <p className="font-hindi text-lg" style={{ color: 'var(--maroon)' }}>{product.hindiName}</p>}
              <h1 className="font-display text-[26px] md:text-4xl mt-0.5 leading-tight" style={{ color: 'var(--ink)' }}>{product.name}</h1>
              {product.ratingAvg > 0 && <div className="mt-2"><StarRating rating={product.ratingAvg} showCount count={product.ratingCount} size={14} /></div>}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold" style={{ color: 'var(--maroon)' }}>{fmt(product.price)}</span>
              {discount > 0 && <span className="text-lg text-stone-400 line-through">{fmt(product.mrp)}</span>}
            </div>

            {/* Story — signature block */}
            {product.story && (
              <div className="relative rounded-2xl p-5 overflow-hidden" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--maroon) 8%, white), color-mix(in srgb, var(--gold) 10%, white))' }}>
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'var(--gold)' }} />
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--maroon)' }}>
                  <Sparkles size={14} style={{ color: 'var(--gold)' }} />
                  <span className="font-hindi tracking-normal text-sm normal-case">{settings.slogan}</span>
                </div>
                <p className="mt-2 leading-relaxed text-sm" style={{ color: 'var(--ink)' }}>{product.story}</p>
              </div>
            )}

            {product.description && product.description !== product.story && (
              <p className="text-stone-500 leading-relaxed text-sm">{product.description}</p>
            )}

            {/* Spec chips */}
            {specs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {specs.map((s) => (
                  <div key={s.label} className="rounded-xl px-3.5 py-2" style={{ background: 'color-mix(in srgb, var(--beige) 60%, white)' }}>
                    <span className="block text-[10px] uppercase tracking-wider text-stone-400">{s.label}</span>
                    <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tags — as hashtags */}
            {product.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.tags.map((t) => (
                  <span key={t} className="text-xs font-semibold rounded-full px-3 py-1" style={{ background: 'color-mix(in srgb, var(--gold) 14%, transparent)', color: 'var(--maroon-dark)' }}>
                    #{String(t).replace(/\s+/g, '')}
                  </span>
                ))}
              </div>
            )}

            {/* Desktop actions (mobile uses the sticky bar) */}
            <div className="hidden lg:flex gap-3 pt-1">
              <button onClick={handleAddToCart} disabled={!inStock || adding} className="btn-maroon flex-1 disabled:opacity-50">
                <ShoppingBag size={16} />{adding ? 'Added!' : inStock ? pc.addToBag : pc.soldOut}
              </button>
              <button onClick={() => toggle({ ...product, id: pid })} className="w-12 h-12 grid place-items-center rounded-full border transition-all cursor-pointer shrink-0" style={{ borderColor: wishlisted ? '#f43f5e' : 'color-mix(in srgb, var(--gold) 40%, transparent)' }} aria-label="Wishlist">
                <Heart size={18} className={wishlisted ? 'fill-rose-500 text-rose-500' : 'text-stone-400'} />
              </button>
            </div>

            {/* Trust bar */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--beige) 55%, white)' }}>
                <Truck size={16} style={{ color: 'var(--maroon)' }} />
                <p className="text-xs text-stone-600">{settings.shippingNote || 'Fast, tracked delivery across India'}</p>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--beige) 55%, white)' }}>
                <Gift size={16} style={{ color: 'var(--maroon)' }} />
                <p className="text-xs text-stone-600">{pc.packagingNote}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-14 px-4 lg:px-0">
            <h2 className="font-display text-2xl md:text-3xl mb-6" style={{ color: 'var(--ink)' }}>You May Also Love</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6" style={{ display: 'grid' }}>
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky mobile buy bar ───────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t backdrop-blur-md px-4 pt-3" style={{ background: 'color-mix(in srgb, var(--cream) 88%, transparent)', borderColor: 'color-mix(in srgb, var(--gold) 25%, transparent)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
        <div className="flex items-center gap-3">
          <div className="leading-tight">
            <span className="block text-[10px] uppercase tracking-wider text-stone-400">Price</span>
            <span className="block text-lg font-bold" style={{ color: 'var(--maroon)' }}>{fmt(product.price)}</span>
          </div>
          <button onClick={handleAddToCart} disabled={!inStock || adding} className="btn-maroon flex-1 disabled:opacity-50">
            <ShoppingBag size={16} />{adding ? 'Added!' : inStock ? pc.addToBag : pc.soldOut}
          </button>
        </div>
      </div>
    </div>
  )
}
