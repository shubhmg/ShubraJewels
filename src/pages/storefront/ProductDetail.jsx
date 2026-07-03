import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heart, ShoppingBag, Truck, Gift, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCartStore } from '../../store/cartStore.js'
import { useWishlistStore } from '../../store/wishlistStore.js'
import { Badge } from '../../components/ui/Badge.jsx'
import { StarRating } from '../../components/ui/StarRating.jsx'
import { ProductCard } from '../../components/product/ProductCard.jsx'
import { WhatsAppButton } from '../../components/ui/WhatsAppButton.jsx'
import { Motif } from '../../components/decor/Decor.jsx'
import { useProduct, useProducts } from '../../hooks/useApi.js'
import { useSettings } from '../../lib/SettingsProvider.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)

export function ProductDetail() {
  const { id } = useParams()
  const { data: product, loading } = useProduct(id)
  const { data: allProducts } = useProducts()
  const settings = useSettings()

  const [imgIdx, setImgIdx] = useState(0)
  const [adding, setAdding] = useState(false)
  const { addItem, openCart } = useCartStore()
  const { toggle, has } = useWishlistStore()

  useEffect(() => { setImgIdx(0); window.scrollTo(0, 0) }, [id])

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

  const handleAddToCart = () => {
    setAdding(true)
    addItem({ ...product, id: pid }, 'One Size')
    setTimeout(() => { setAdding(false); openCart() }, 700)
  }

  return (
    <div className="pt-20 min-h-dvh animate-fade-in" style={{ background: 'var(--cream)' }}>
      <div className="container-wide py-4">
        <nav className="flex items-center gap-1.5 text-xs text-stone-400">
          <Link to="/" className="hover:text-[var(--maroon)]">Home</Link><span>/</span>
          <Link to="/products" className="hover:text-[var(--maroon)]">Jhumkas</Link><span>/</span>
          <span style={{ color: 'var(--ink)' }}>{product.name}</span>
        </nav>
      </div>

      <div className="container-wide pb-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Images */}
          <div className="space-y-3">
            <div className="relative aspect-square rounded-2xl overflow-hidden temple-frame group" style={{ background: 'var(--beige)' }}>
              <img src={images[imgIdx]} alt={product.name} className="w-full h-full object-cover" />
              {images.length > 1 && (
                <>
                  <button onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm grid place-items-center opacity-0 group-hover:opacity-100 transition shadow-sm" aria-label="Previous"><ChevronLeft size={16} /></button>
                  <button onClick={() => setImgIdx((i) => (i + 1) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm grid place-items-center opacity-0 group-hover:opacity-100 transition shadow-sm" aria-label="Next"><ChevronRight size={16} /></button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} className="w-16 h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer" style={{ borderColor: i === imgIdx ? 'var(--gold)' : 'transparent', opacity: i === imgIdx ? 1 : 0.6 }}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {product.isNewArrival && <Badge variant="new">New Arrival</Badge>}
              {product.isBestseller && <Badge variant="bestseller">Bestseller</Badge>}
              {!inStock && <Badge variant="default">Sold Out</Badge>}
            </div>

            <div>
              {product.hindiName && <p className="font-hindi text-lg" style={{ color: 'var(--maroon)' }}>{product.hindiName}</p>}
              <h1 className="font-display text-3xl md:text-4xl mt-0.5 leading-snug" style={{ color: 'var(--ink)' }}>{product.name}</h1>
            </div>

            {product.ratingAvg > 0 && <StarRating rating={product.ratingAvg} showCount count={product.ratingCount} size={14} />}

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold" style={{ color: 'var(--maroon)' }}>{fmt(product.price)}</span>
              {discount > 0 && <><span className="text-lg text-stone-400 line-through">{fmt(product.mrp)}</span><Badge variant="sale">Save {discount}%</Badge></>}
            </div>

            {/* Story — the signature "हर झुमका एक कहानी" block */}
            {product.story && (
              <div className="rounded-2xl p-5" style={{ background: 'color-mix(in srgb, var(--beige) 60%, white)' }}>
                <div className="eyebrow"><Motif size={16} />{settings.slogan}</div>
                <p className="mt-2 leading-relaxed text-sm" style={{ color: 'var(--ink)' }}>{product.story}</p>
              </div>
            )}

            {product.description && product.description !== product.story && (
              <p className="text-stone-500 leading-relaxed text-sm">{product.description}</p>
            )}

            <dl className="grid grid-cols-2 gap-2.5 text-sm">
              {[
                { dt: 'Material', dd: product.material },
                { dt: 'Weight', dd: product.weight },
                { dt: 'SKU', dd: product.sku },
              ].filter((x) => x.dd).map(({ dt, dd }) => (
                <div key={dt} className="flex gap-2">
                  <dt className="text-stone-400 min-w-[70px]">{dt}:</dt>
                  <dd className="font-medium" style={{ color: 'var(--ink)' }}>{dd}</dd>
                </div>
              ))}
            </dl>

            <div className="h-px" style={{ background: 'color-mix(in srgb, var(--gold) 30%, transparent)' }} />

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <button onClick={handleAddToCart} disabled={!inStock || adding} className="btn-maroon flex-1 min-w-[160px] disabled:opacity-50">
                <ShoppingBag size={16} />{adding ? 'Added!' : inStock ? 'Add to Bag' : 'Sold Out'}
              </button>
              <button onClick={() => toggle({ ...product, id: pid })} className="w-12 h-12 grid place-items-center rounded-full border transition-all cursor-pointer" style={{ borderColor: wishlisted ? '#f43f5e' : 'color-mix(in srgb, var(--gold) 40%, transparent)' }} aria-label="Wishlist">
                <Heart size={18} className={wishlisted ? 'fill-rose-500 text-rose-500' : 'text-stone-400'} />
              </button>
            </div>
            <WhatsAppButton product={product} className="w-full" />

            {/* Trust bar */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--beige) 55%, white)' }}>
                <Truck size={16} style={{ color: 'var(--maroon)' }} />
                <p className="text-xs text-stone-600">Free shipping in {settings.freeShippingCity}</p>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--beige) 55%, white)' }}>
                <Gift size={16} style={{ color: 'var(--maroon)' }} />
                <p className="text-xs text-stone-600">Gift-ready packaging</p>
              </div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-20">
            <h2 className="font-display text-3xl mb-8" style={{ color: 'var(--ink)' }}>You May Also Love</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
