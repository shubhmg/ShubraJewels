import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { Badge } from '../ui/Badge.jsx'
import { StarRating } from '../ui/StarRating.jsx'
import { useWishlistStore } from '../../store/wishlistStore.js'

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
  }
}

export function ProductCard({ product, dark = false }) {
  const { toggle, has } = useWishlistStore()
  const f = fields(product)
  const wishlisted = has(f.id)
  const inStock = product.inStock !== false

  const discount = f.originalPrice > product.price
    ? Math.round((1 - product.price / f.originalPrice) * 100)
    : 0

  const textColor = dark ? '#fff' : 'var(--ink)'
  const subColor  = dark ? 'rgba(255,255,255,0.55)' : undefined
  const hindiColor = dark ? 'var(--gold-light)' : 'var(--maroon)'

  return (
    <div className="group relative flex flex-col animate-fade-in">
      <Link to={`/products/${f.id}`} className="block">
        <div
          className="product-img-wrap relative aspect-[3/4] rounded-2xl overflow-hidden"
          style={{ background: 'color-mix(in srgb, var(--beige) 60%, white)' }}
        >
          <img src={f.images[0]} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />

          {/* Badges — default size on web, smaller only on mobile */}
          <div className="absolute top-3 left-3 flex flex-col gap-1 md:gap-1.5">
            {f.isNew && <Badge variant="new" className="!text-[10px] !px-2 md:!text-xs md:!px-2.5">New</Badge>}
            {product.isBestseller && <Badge variant="bestseller" className="!text-[10px] !px-2 md:!text-xs md:!px-2.5">Bestseller</Badge>}
            {discount > 0 && <Badge variant="sale" className="!text-[10px] !px-2 md:!text-xs md:!px-2.5">-{discount}%</Badge>}
            {!inStock && <Badge variant="default" className="!text-[10px] !px-2 md:!text-xs md:!px-2.5">Sold Out</Badge>}
          </div>
        </div>
      </Link>

      {/* Wishlist */}
      <button
        onClick={() => toggle({ ...product, id: f.id })}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm hover:scale-110 transition-transform duration-200 cursor-pointer"
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart size={13} className={wishlisted ? 'fill-rose-500 text-rose-500' : 'text-stone-400'} />
      </button>

      {/* Info */}
      <div className="mt-3 px-0.5">
        {f.material && (
          <p className="text-[10px] tracking-widest font-medium uppercase mb-0.5" style={{ color: subColor || 'rgb(161,155,150)' }}>
            {f.material}
          </p>
        )}
        <Link to={`/products/${f.id}`}>
          <h3
            className="font-display text-base leading-snug transition-colors"
            style={{ color: textColor, fontWeight: 700 }}
          >
            {product.name}
          </h3>
        </Link>
        {product.hindiName && (
          <p className="font-hindi text-xs mt-0.5" style={{ color: hindiColor }}>
            {product.hindiName}
          </p>
        )}
        {f.rating > 0 && (
          <div className="mt-1">
            <StarRating rating={f.rating} showCount count={f.reviews} size={11} textColor={subColor} />
          </div>
        )}
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="font-bold text-sm" style={{ color: textColor }}>{fmt(product.price)}</span>
          {discount > 0 && (
            <span className="text-xs line-through" style={{ color: subColor || 'rgb(161,155,150)' }}>
              {fmt(f.originalPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
