import { Motif } from '../decor/Decor.jsx'

// Consistent royal section heading: eyebrow + big display title + optional Hindi + subtitle.
export function SectionHeading({ eyebrow, title, hindi, subtitle, center = true, light = false }) {
  return (
    <div className={`${center ? 'text-center mx-auto' : ''} max-w-2xl mb-10 md:mb-14`}>
      {eyebrow && (
        <div className={`eyebrow ${center ? 'justify-center' : ''} flex`}>
          <Motif size={18} />
          {eyebrow}
        </div>
      )}
      {hindi && (
        <p className="font-hindi text-lg md:text-xl mt-3" style={{ color: 'var(--maroon)' }}>
          {hindi}
        </p>
      )}
      <h2
        className={`font-display text-3xl md:text-5xl mt-1 leading-tight ${light ? 'text-white' : ''}`}
        style={light ? undefined : { color: 'var(--ink)' }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-3 text-sm md:text-base ${light ? 'text-white/70' : 'text-stone-500'}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
