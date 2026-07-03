import { Star } from 'lucide-react'

export function StarRating({ rating, size = 14, showCount, count }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(n => (
          <Star
            key={n}
            size={size}
            className={n <= Math.round(rating) ? 'text-gold-500 fill-gold-500' : 'text-stone-300 fill-stone-100'}
          />
        ))}
      </span>
      {showCount && <span className="text-xs text-stone-500 ml-1">({count})</span>}
    </span>
  )
}
