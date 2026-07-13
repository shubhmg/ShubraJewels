import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { StarRating } from '../ui/StarRating.jsx'
import { useWishlistStore } from '../../store/wishlistStore.js'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n || 0))

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

// Thin uppercase micro-label overlaid on the image (editorial, not a chunky pill).
function Tag({ children, tone = 'light' }) {
  const styles = tone === 'sale'
    ? { background: 'var(--maroon)', color: 'var(--cream)' }
    : tone === 'dark'
    ? { background: 'rgba(20,12,10,0.72)', color: '#fff' }
    : { background: 'rgba(255,255,255,0.92)', color: 'var(--ink)' }
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm"
      style={styles}
    >
      {children}
    </span>
  )
}

export function ProductCard({ product, dark = false }) {
  const { toggle, has } = useWishlistStore()
  const f = fields(product)
  const wishlisted = has(f.id)
  const inStock = product.inStock !== false

  const discount = f.originalPrice > product.price
    ? Math.round((1 - product.price / f.originalPrice) * 100)
    : 0

  // Info text adapts to a dark section background (else it'd be dark-on-dark).
  const c = dark
    ? { material: 'rgba(255,255,255,0.55)', name: '#ffffff', hindi: 'var(--gold-light)', price: '#ffffff', strike: 'rgba(255,255,255,0.4)' }
    : { material: '#a8a29e', name: 'var(--ink)', hindi: 'var(--maroon)', price: 'var(--ink)', strike: '#a8a29e' }

  return (
    <div className="group relative flex h-full flex-col animate-fade-in">
      {/* Image */}
      <Link to={`/products/${f.id}`} className="block">
        <div
          className="relative aspect-[3/4] overflow-hidden rounded-[14px]"
          style={{ background: 'color-mix(in srgb, var(--beige) 60%, white)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--ink) 6%, transparent)' }}
        >
          <img
            src={f.images[0]}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
          />
          {/* hover wash + view cue */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
               style={{ background: 'linear-gradient(to top, rgba(20,12,10,0.55), transparent)' }} />
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 translate-y-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            View
          </span>

          {/* micro badges */}
          <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
            {!inStock && <Tag tone="dark">Sold Out</Tag>}
            {discount > 0 && inStock && <Tag tone="sale">−{discount}%</Tag>}
            {f.isNew && inStock && <Tag>New</Tag>}
            {product.isBestseller && inStock && !f.isNew && <Tag>Bestseller</Tag>}
          </div>
        </div>
      </Link>

      {/* Wishlist */}
      <button
        onClick={() => toggle({ ...product, id: f.id })}
        className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/85 shadow-sm backdrop-blur-sm transition-transform duration-200 hover:scale-110 cursor-pointer"
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart size={14} className={wishlisted ? 'fill-rose-500 text-rose-500' : 'text-stone-400'} />
      </button>

      {/* Info */}
      <div className="flex flex-1 flex-col pt-3">
        {f.material && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: c.material }}>{f.material}</p>
        )}
        <Link to={`/products/${f.id}`} className="mt-1">
          <h3 className="font-display text-[15px] leading-snug link-underline inline"
              style={{ color: c.name, fontWeight: 500 }}>
            {product.name}
          </h3>
        </Link>
        {product.hindiName && (
          <p className="font-hindi text-xs mt-0.5" style={{ color: c.hindi }}>{product.hindiName}</p>
        )}
        {f.rating > 0 && (
          <div className="mt-1.5"><StarRating rating={f.rating} showCount count={f.reviews} size={11} /></div>
        )}
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-[15px] font-semibold tabular-nums" style={{ color: c.price }}>{fmt(product.price)}</span>
          {discount > 0 && <span className="text-xs line-through tabular-nums" style={{ color: c.strike }}>{fmt(f.originalPrice)}</span>}
        </div>
      </div>
    </div>
  )
}
