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

// Decorative backdrop — a cluster of hanging jhumka earrings (NOT a mandala).
// Kept the export name `Mandala` so every call site swaps at once.
export function Mandala({ size = 320, className = '', style }) {
  const solid = 'var(--gold)'
  const tint = 'color-mix(in srgb, var(--gold) 16%, transparent)'

  // One hanging jhumka: thread → stud → bell dome → jhalar fringe → drop.
  const jhumka = (cx, topY, k, key) => {
    const studY = topY + 20 * k
    const baseY = studY + 22 * k
    const bellR = 17 * k
    const dropY = baseY + 15 * k
    return (
      <g key={key}>
        <line x1={cx} y1={topY} x2={cx} y2={studY} />
        <circle cx={cx} cy={studY} r={2.8 * k} fill={solid} stroke="none" />
        {/* bell dome */}
        <path d={`M ${cx - bellR} ${baseY} A ${bellR} ${bellR} 0 0 1 ${cx + bellR} ${baseY} Z`} fill={tint} />
        {/* jhalar fringe of moti */}
        {[-2, -1, 0, 1, 2].map((n) => (
          <circle key={n} cx={cx + n * (bellR / 2.4)} cy={baseY + 3 * k} r={2.3 * k} fill={solid} stroke="none" />
        ))}
        {/* central drop bell */}
        <line x1={cx} y1={baseY} x2={cx} y2={dropY - 3.4 * k} />
        <circle cx={cx} cy={dropY} r={3.6 * k} fill={tint} />
      </g>
    )
  }

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
      <g strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round">
        {/* garland thread the earrings hang from */}
        <path d="M44 52 Q120 34 196 52" />
        {jhumka(74, 46, 0.9, 'a')}
        {jhumka(120, 40, 1.15, 'b')}
        {jhumka(166, 46, 0.9, 'c')}
      </g>
    </svg>
  )
}

// Heading ornament — a tiny pair of jhumka earrings.
export function Motif({ className = '', size = 26 }) {
  const tint = 'color-mix(in srgb, var(--gold) 25%, transparent)'
  const jhumka = (x) => (
    <g key={x}>
      {/* hook ring + connector */}
      <circle cx={x} cy="7" r="1.3" />
      <path d={`M${x} 8.3V10.4`} />
      {/* bell dome */}
      <path d={`M${x - 4} 17c0-4 1.6-6.6 4-6.6s4 2.6 4 6.6z`} fill={tint} />
      {/* jhalar drop-bells */}
      <circle cx={x - 2.6} cy="18.4" r="0.9" fill="var(--gold)" stroke="none" />
      <circle cx={x} cy="18.8" r="0.9" fill="var(--gold)" stroke="none" />
      <circle cx={x + 2.6} cy="18.4" r="0.9" fill="var(--gold)" stroke="none" />
      {/* central drop */}
      <circle cx={x} cy="22" r="1.3" fill={tint} />
    </g>
  )
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" className={className} fill="none" stroke="var(--gold)" strokeWidth="1">
      {jhumka(10.5)}
      {jhumka(21.5)}
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
