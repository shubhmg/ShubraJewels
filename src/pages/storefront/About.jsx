import { Link } from 'react-router-dom'
import { Sparkles, HandHeart, Truck, ShieldCheck, Gem, Award, Heart, Leaf, Crown, Star, Flower, BadgeCheck } from 'lucide-react'
import { Mandala, Motif, MehendiDivider, TempleFrame } from '../../components/decor/Decor.jsx'
import { useSettings } from '../../lib/SettingsProvider.jsx'
import { resolveAbout } from '../../lib/aboutContent.js'
import { resolveContent } from '../../lib/siteContent.js'

const ICON_MAP = { HandHeart, Sparkles, Truck, ShieldCheck, Gem, Award, Heart, Leaf, Crown, Star, Flower, BadgeCheck }

export function About() {
  const settings = useSettings()
  const about = resolveAbout(settings.about)
  const eyebrow = resolveContent(settings.content).pages.about.eyebrow
  const fillBrand = (t) => String(t || '').replace(/\{brand\}/g, settings.brandName)

  return (
    <div className="min-h-dvh animate-fade-in" style={{ background: 'var(--cream)' }}>
      {/* Hero */}
      <div className="relative overflow-hidden text-center" style={{ background: 'var(--maroon-dark)' }}>
        <Mandala size={300} className="hidden md:block absolute right-0 md:right-8 top-16 md:top-24 opacity-15 pointer-events-none" />
        <div className="container-wide pt-28 md:pt-36 pb-16 md:pb-20 relative">
          <div className="eyebrow justify-center flex"><Motif size={20} />{eyebrow}</div>
          <p className="font-hindi text-2xl md:text-3xl text-[var(--gold-light)] mt-3">{settings.slogan}</p>
          <h1 className="font-display text-white text-4xl md:text-6xl leading-tight mt-1">{settings.brandName}</h1>
          <p className="mt-4 text-white/70 max-w-xl mx-auto text-sm md:text-base">{settings.aboutShort}</p>
        </div>
        <MehendiDivider />
      </div>

      {/* Story */}
      <section className="section container-wide grid md:grid-cols-2 gap-12 items-center">
        <TempleFrame className="aspect-[4/5] max-w-sm w-full mx-auto shadow-card">
          <img src={about.image} alt="Artisan crafting a jhumka" className="w-full h-full object-cover" />
        </TempleFrame>
        <div>
          <div className="eyebrow"><Motif size={18} />{about.eyebrow}</div>
          <h2 className="font-display text-3xl md:text-4xl mt-2 mb-4" style={{ color: 'var(--ink)' }}>{about.heading}</h2>
          <div className="space-y-4 text-stone-600 text-sm leading-relaxed">
            {about.paragraphs.map((p, i) => <p key={i}>{fillBrand(p)}</p>)}
            <p className="font-hindi text-base" style={{ color: 'var(--maroon)' }}>{settings.slogan} — {settings.sloganEnglish}.</p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/products" className="btn-maroon">Shop the Collection</Link>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section" style={{ background: 'color-mix(in srgb, var(--beige) 45%, var(--cream))' }}>
        <div className="container-wide grid grid-cols-2 md:grid-cols-4 gap-5">
          {about.values.map(({ icon, title, text }, i) => {
            const Icon = ICON_MAP[icon] || Sparkles
            return (
              <div key={i} className="rounded-2xl p-6 bg-white shadow-card text-center">
                <div className="w-12 h-12 rounded-full grid place-items-center mx-auto mb-3" style={{ background: 'color-mix(in srgb, var(--gold) 18%, transparent)' }}>
                  <Icon size={20} style={{ color: 'var(--maroon)' }} />
                </div>
                <h3 className="font-display text-lg" style={{ color: 'var(--ink)' }}>{title}</h3>
                <p className="text-xs text-stone-500 mt-1">{text}</p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
