import { Motif } from '../decor/Decor.jsx'

// Editorial royal section heading: eyebrow + large refined-serif title + optional
// Hindi + subtitle. Fraunces at a light weight gives the fashion-editorial feel.
export function SectionHeading({ eyebrow, title, hindi, subtitle, center = true, light = false }) {
  return (
    <div className={`${center ? 'text-center mx-auto' : ''} max-w-2xl mb-10 md:mb-16`}>
      {eyebrow && (
        <div className={`eyebrow ${center ? 'justify-center' : ''} flex`}>
          <Motif size={16} />
          {eyebrow}
        </div>
      )}
      {hindi && (
        <p className="font-hindi text-lg md:text-xl mt-4" style={{ color: light ? 'var(--gold-light)' : 'var(--maroon)' }}>
          {hindi}
        </p>
      )}
      <h2
        className={`font-display text-[2rem] leading-[1.05] md:text-[3.25rem] mt-2 ${light ? 'text-white' : ''}`}
        style={{ fontWeight: 400, letterSpacing: '-0.02em', ...(light ? {} : { color: 'var(--ink)' }) }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 text-[15px] leading-relaxed ${light ? 'text-white/65' : 'text-stone-500'}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
