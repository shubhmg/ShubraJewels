import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Heart, ShoppingBag, Eye } from 'lucide-react'
import { Badge } from '../ui/Badge.jsx'
import { StarRating } from '../ui/StarRating.jsx'
import { useCartStore } from '../../store/cartStore.js'
import { useWishlistStore } from '../../store/wishlistStore.js'
import { useSettings, whatsappLink } from '../../lib/SettingsProvider.jsx'
import { Tilt } from '../motion/Motion.jsx'

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

// Tolerant of both the API product shape and the legacy mock shape.
function fields(p) {
  return {
    id: p.id || p._id,
    images: p.images?.length ? p.images : ['https://via.placeholder.com/600x800?text=Jhumka'],
    material: p.material || p.metal || '',
    rating: p.ratingAvg ?? p.rating ?? 0,
    reviews: p.ratingCount ?? p.reviews ?? 0,
    isNew: p.isNewArrival ?? p.isNew ?? false,
    originalPrice: p.mrp || p.originalPrice || 0,
    size: p.sizes?.[0] || 'One Size',
  }
}

export function ProductCard({ product }) {
  const [adding, setAdding] = useState(false)
  const { addItem, openCart } = useCartStore()
  const { toggle, has } = useWishlistStore()
  const settings = useSettings()
  const f = fields(product)
  const wishlisted = has(f.id)
  const inStock = product.inStock !== false

  const handleAddToCart = (e) => {
    e.preventDefault()
    if (!inStock) return
    setAdding(true)
    addItem({ ...product, id: f.id }, f.size)
    setTimeout(() => { setAdding(false); openCart() }, 600)
  }

  const discount = f.originalPrice > product.price
    ? Math.round((1 - product.price / f.originalPrice) * 100)
    : 0

  const wa = whatsappLink(
    settings,
    `${settings.whatsappMessage || 'Hello! I would like to order:'} ${product.name}${product.hindiName ? ` (${product.hindiName})` : ''} — ${fmt(product.price)}`
  )

  return (
    <div className="group relative flex flex-col animate-fade-in">
      <Link to={`/products/${f.id}`} className="block">
        <Tilt
          max={7}
          className="product-img-wrap relative aspect-[3/4] rounded-2xl overflow-hidden"
          style={{ background: 'color-mix(in srgb, var(--beige) 60%, white)' }}
        >
          <img src={f.images[0]} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          {f.images[1] && (
            <img
              src={f.images[1]}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-spring"
              loading="lazy"
              decoding="async"
            />
          )}

          <div className="absolute inset-0 group-hover:bg-[rgba(42,26,22,0.18)] transition-all duration-300" />

          {/* Quick action bar — always visible on mobile (icon-only), slides up on hover on desktop */}
          <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 transition-transform duration-300 ease-spring translate-y-0 md:translate-y-full md:group-hover:translate-y-0">
            <div className="flex gap-1.5 sm:gap-2">
              <button
                onClick={handleAddToCart}
                disabled={!inStock || adding}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 sm:h-10 rounded-lg sm:rounded-xl text-xs font-semibold backdrop-blur-sm transition-all duration-200 disabled:opacity-60 cursor-pointer"
                style={{ background: 'var(--maroon)', color: 'var(--cream)' }}
                aria-label="Add to cart"
              >
                <ShoppingBag size={15} />
                <span className="hidden sm:inline">{adding ? 'Added!' : inStock ? 'Add to Bag' : 'Sold Out'}</span>
              </button>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 sm:flex-none sm:w-10 flex items-center justify-center h-9 sm:h-10 rounded-lg sm:rounded-xl backdrop-blur-sm transition-all duration-200"
                  style={{ background: '#25D366', color: '#06351b' }}
                  aria-label="Order on WhatsApp"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm4.6 12.16c-.25-.13-1.47-.72-1.7-.81-.23-.08-.4-.13-.56.13-.17.25-.65.8-.79.97-.15.17-.29.19-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42h-.48c-.17 0-.44.06-.67.31s-.88.86-.88 2.07c0 1.22.9 2.4 1.02 2.56.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.23-.17-.48-.29Z" /></svg>
                </a>
              )}
              <Link
                to={`/products/${f.id}`}
                className="flex-1 sm:flex-none sm:w-10 flex items-center justify-center h-9 sm:h-10 rounded-lg sm:rounded-xl bg-white/90 backdrop-blur-sm hover:bg-white transition-all duration-200"
                aria-label="Quick view"
              >
                <Eye size={16} style={{ color: 'var(--ink)' }} />
              </Link>
            </div>
          </div>

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {f.isNew && <Badge variant="new">New</Badge>}
            {product.isBestseller && <Badge variant="bestseller">Bestseller</Badge>}
            {discount > 0 && <Badge variant="sale">-{discount}%</Badge>}
            {!inStock && <Badge variant="default">Sold Out</Badge>}
          </div>
        </Tilt>
      </Link>

      {/* Wishlist */}
      <button
        onClick={() => toggle({ ...product, id: f.id })}
        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm hover:scale-110 transition-transform duration-200 cursor-pointer"
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart size={15} className={wishlisted ? 'fill-rose-500 text-rose-500' : 'text-stone-400'} />
      </button>

      {/* Info */}
      <div className="mt-4 space-y-1 px-0.5">
        {f.material && <p className="text-[11px] text-stone-400 tracking-wide font-medium uppercase">{f.material}</p>}
        <Link to={`/products/${f.id}`}>
          <h3 className="font-display text-lg leading-snug transition-colors" style={{ color: 'var(--ink)' }}>
            {product.name}
          </h3>
        </Link>
        {product.hindiName && <p className="font-hindi text-sm" style={{ color: 'var(--maroon)' }}>{product.hindiName}</p>}
        {f.rating > 0 && <StarRating rating={f.rating} showCount count={f.reviews} size={12} />}
        <div className="flex items-baseline gap-2 pt-1">
          <span className="font-semibold text-base" style={{ color: 'var(--ink)' }}>{fmt(product.price)}</span>
          {discount > 0 && <span className="text-sm text-stone-400 line-through">{fmt(f.originalPrice)}</span>}
        </div>
      </div>
    </div>
  )
}
