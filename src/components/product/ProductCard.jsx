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
    <div className="group relative animate-fade-in rounded-2xl overflow-hidden shadow-sm" style={{ background: 'color-mix(in srgb, var(--beige) 45%, white)' }}>

      {/* Image */}
      <Link to={`/products/${f.id}`} className="block">
        <div className="product-img-wrap relative aspect-[3/4] overflow-hidden">
          <img src={f.images[0]} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {f.isNew        && <Badge variant="new"        className="!text-[10px] !px-2 !py-0.5">New</Badge>}
            {product.isBestseller && <Badge variant="bestseller" className="!text-[10px] !px-2 !py-0.5">Bestseller</Badge>}
            {discount > 0   && <Badge variant="sale"       className="!text-[10px] !px-2 !py-0.5">-{discount}%</Badge>}
            {!inStock        && <Badge variant="default"    className="!text-[10px] !px-2 !py-0.5">Sold Out</Badge>}
          </div>
        </div>
      </Link>

      {/* Wishlist — floats over the card */}
      <button
        onClick={() => toggle({ ...product, id: f.id })}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm hover:scale-110 transition-transform duration-200 cursor-pointer"
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart size={13} className={wishlisted ? 'fill-rose-500 text-rose-500' : 'text-stone-400'} />
      </button>

      {/* Info — sits on the card's own beige background, always light */}
      <div className="px-3 py-3">
        {f.material && (
          <p className="text-[10px] tracking-widest font-medium uppercase mb-0.5" style={{ color: 'rgb(120,110,100)' }}>
            {f.material}
          </p>
        )}
        <Link to={`/products/${f.id}`}>
          <h3
            className="font-display text-sm leading-snug transition-colors hover:opacity-80"
            style={{ color: 'var(--ink)', fontWeight: 700 }}
          >
            {product.name}
          </h3>
        </Link>
        {product.hindiName && (
          <p className="font-hindi text-xs mt-0.5" style={{ color: 'var(--maroon)' }}>
            {product.hindiName}
          </p>
        )}
        {f.rating > 0 && (
          <div className="mt-1">
            <StarRating rating={f.rating} showCount count={f.reviews} size={11} />
          </div>
        )}
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="font-bold text-sm" style={{ color: 'var(--maroon)' }}>{fmt(product.price)}</span>
          {discount > 0 && (
            <span className="text-xs line-through text-stone-400">{fmt(f.originalPrice)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
