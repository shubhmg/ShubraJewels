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

export function ProductCard({ product }) {
  const { toggle, has } = useWishlistStore()
  const f = fields(product)
  const wishlisted = has(f.id)
  const inStock = product.inStock !== false

  const discount = f.originalPrice > product.price
    ? Math.round((1 - product.price / f.originalPrice) * 100)
    : 0

  return (
    <div className="group relative animate-fade-in">

      {/* Image — editorial frame, gentle zoom on hover */}
      <Link to={`/products/${f.id}`} className="block">
        <div className="product-img-wrap relative aspect-[3/4] rounded-2xl overflow-hidden" style={{ background: 'color-mix(in srgb, var(--beige) 55%, white)', boxShadow: '0 1px 2px rgba(42,26,22,0.06), 0 18px 36px -22px rgba(42,26,22,0.35)' }}>
          <img src={f.images[0]} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]" />
          <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)' }} />
        </div>
      </Link>

      {/* Wishlist — floats over the image */}
      <button
        onClick={() => toggle({ ...product, id: f.id })}
        className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-md shadow-sm hover:scale-110 transition-transform duration-200 cursor-pointer"
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart size={13} className={wishlisted ? 'fill-rose-500 text-rose-500' : 'text-stone-400'} />
      </button>

      {/* Info */}
      <div className="pt-3 px-0.5">
        {(f.isNew || product.isBestseller || !inStock) && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {f.isNew && <Badge variant="new" className="!text-[9px] !px-1.5 !py-0.5">New</Badge>}
            {product.isBestseller && <Badge variant="bestseller" className="!text-[9px] !px-1.5 !py-0.5">Bestseller</Badge>}
            {!inStock && <Badge variant="soldout" className="!text-[9px] !px-1.5 !py-0.5">Sold Out</Badge>}
          </div>
        )}
        {f.material && (
          <p className="text-[9px] tracking-[0.22em] font-semibold uppercase mb-1" style={{ color: 'color-mix(in srgb, var(--maroon) 55%, transparent)' }}>
            {f.material}
          </p>
        )}
        <Link to={`/products/${f.id}`}>
          <h3 className="font-display text-[15px] leading-snug transition-colors group-hover:opacity-70" style={{ color: 'var(--ink)', fontWeight: 560 }}>
            {product.name}
          </h3>
        </Link>
        {product.hindiName && (
          <p className="font-hindi text-xs mt-0.5" style={{ color: 'var(--maroon)' }}>
            {product.hindiName}
          </p>
        )}
        {f.rating > 0 && (
          <div className="mt-1.5">
            <StarRating rating={f.rating} showCount count={f.reviews} size={11} />
          </div>
        )}
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-[15px]" style={{ color: 'var(--maroon)', fontWeight: 600 }}>{fmt(product.price)}</span>
          {discount > 0 && (
            <span className="text-xs line-through text-stone-400">{fmt(f.originalPrice)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
