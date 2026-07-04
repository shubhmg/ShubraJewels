// Reusable Rajasthani design elements: mandala backdrop, mehendi divider,
// temple-arch frame, and a small motif. Pure SVG/CSS, tint follows --gold.

export function MehendiDivider({ className = '', flip = false }) {
  return (
    <div
      aria-hidden
      className={`mehendi-divider w-full ${className}`}
      style={flip ? { transform: 'scaleY(-1)' } : undefined}
    />
  )
}

export function Mandala({ size = 320, className = '', style }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 240 240"
      className={className}
      style={style}
      fill="none"
      stroke="var(--gold)"
    >
      <g strokeOpacity="0.35" strokeWidth="1">
        {[26, 46, 68, 90, 112].map((r) => (
          <circle key={r} cx="120" cy="120" r={r} />
        ))}
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i * Math.PI) / 8
          return (
            <line
              key={i}
              x1="120"
              y1="120"
              x2={120 + 112 * Math.cos(a)}
              y2={120 + 112 * Math.sin(a)}
            />
          )
        })}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * Math.PI) / 6
          return (
            <circle key={`p${i}`} cx={120 + 90 * Math.cos(a)} cy={120 + 90 * Math.sin(a)} r="7" />
          )
        })}
      </g>
    </svg>
  )
}

// Small lotus/temple motif used as a heading ornament.
export function Motif({ className = '', size = 26 }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" className={className} fill="none" stroke="var(--gold)" strokeWidth="1.3">
      <path d="M16 3c2.5 4 2.5 8 0 12-2.5-4-2.5-8 0-12Z" fill="color-mix(in srgb, var(--gold) 25%, transparent)" />
      <path d="M16 15c4-2 8-2 12 0-4 3-8 3-12 0Z" />
      <path d="M16 15c-4-2-8-2-12 0 4 3 8 3 12 0Z" />
      <circle cx="16" cy="16" r="1.6" fill="var(--gold)" stroke="none" />
    </svg>
  )
}

// Temple-arch framed media (image/video children).
export function TempleFrame({ children, className = '' }) {
  return <div className={`temple-frame ${className}`}>{children}</div>
}

// Solid jhumka-earring silhouette — used as a scattered background motif.
export function EarringMotif({ size = 120, className = '', style, color = 'var(--gold)' }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size * 1.2}
      viewBox="0 0 40 48"
      className={className}
      style={style}
      fill={color}
    >
      {/* ear hook */}
      <path d="M20 2c-2.5 0-4.4 1.9-4.4 4.2h2.4c0-1.1.9-2 2-2s2 .9 2 2 -.9 2-2 2v2.2c2.5 0 4.4-1.9 4.4-4.2S22.5 2 20 2z" />
      {/* stud */}
      <circle cx="20" cy="12.4" r="2.2" />
      {/* bell */}
      <path d="M20 15c-8.4 0-12.4 8.2-12.4 15 0 1 .8 1.8 1.8 1.8h21.2c1 0 1.8-.8 1.8-1.8 0-6.8-4-15-12.4-15z" />
      {/* skirt of drop-bells */}
      <circle cx="9.6" cy="34.4" r="1.7" />
      <circle cx="14.8" cy="35.8" r="1.7" />
      <circle cx="20" cy="36.2" r="1.7" />
      <circle cx="25.2" cy="35.8" r="1.7" />
      <circle cx="30.4" cy="34.4" r="1.7" />
      {/* central drop */}
      <circle cx="20" cy="43" r="2.6" />
    </svg>
  )
}
