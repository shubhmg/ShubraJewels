import { Star } from 'lucide-react'

export function StarRating({ rating, size = 14, showCount, count, textColor }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(n => (
          <Star
            key={n}
            size={size}
            className={n <= Math.round(rating) ? 'text-gold-500 fill-gold-500' : ''}
            style={n <= Math.round(rating) ? undefined : { color: textColor || '#d6d3d1', fill: textColor ? `${textColor}33` : '#f5f5f4' }}
          />
        ))}
      </span>
      {showCount && <span className="text-xs ml-1" style={{ color: textColor || 'rgb(120,113,108)' }}>({count})</span>}
    </span>
  )
}
