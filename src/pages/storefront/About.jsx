import { Link } from 'react-router-dom'
import { Sparkles, HandHeart, Truck, ShieldCheck } from 'lucide-react'
import { Mandala, Motif, MehendiDivider, TempleFrame } from '../../components/decor/Decor.jsx'
import { WhatsAppButton } from '../../components/ui/WhatsAppButton.jsx'
import { useSettings } from '../../lib/SettingsProvider.jsx'

const VALUES = [
  { icon: HandHeart, title: 'Handcrafted', text: 'Every jhumka is made by hand by Rajasthani artisans.' },
  { icon: Sparkles, title: 'A Story Each', text: 'Every design carries a name and a story of its own.' },
  { icon: Truck, title: 'Delivered with Care', text: 'Free shipping in {city}, pan-India delivery available.' },
  { icon: ShieldCheck, title: 'Quality Promise', text: 'Skin-friendly, long-lasting finish on every pair.' },
]

export function About() {
  const settings = useSettings()

  return (
    <div className="min-h-dvh animate-fade-in" style={{ background: 'var(--cream)' }}>
      {/* Hero */}
      <div className="relative overflow-hidden text-center" style={{ background: 'var(--maroon-dark)' }}>
        <Mandala size={440} className="absolute left-1/2 -translate-x-1/2 -top-24 opacity-15" />
        <div className="container-wide pt-28 md:pt-36 pb-16 md:pb-20 relative">
          <div className="eyebrow justify-center flex"><Motif size={20} />Our Story</div>
          <p className="font-hindi text-2xl md:text-3xl text-[var(--gold-light)] mt-3">{settings.slogan}</p>
          <h1 className="font-display text-white text-4xl md:text-6xl leading-tight mt-1">{settings.brandName}</h1>
          <p className="mt-4 text-white/70 max-w-xl mx-auto text-sm md:text-base">{settings.aboutShort}</p>
        </div>
        <MehendiDivider />
      </div>

      {/* Story */}
      <section className="section container-wide grid md:grid-cols-2 gap-12 items-center">
        <TempleFrame className="aspect-[4/5] max-w-sm w-full mx-auto shadow-card">
          <img src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=85" alt="Artisan crafting a jhumka" className="w-full h-full object-cover" />
        </TempleFrame>
        <div>
          <div className="eyebrow"><Motif size={18} />Rooted in Rajasthan</div>
          <h2 className="font-display text-3xl md:text-4xl mt-2 mb-4" style={{ color: 'var(--ink)' }}>Where every jhumka begins</h2>
          <div className="space-y-4 text-stone-600 text-sm leading-relaxed">
            <p>{settings.brandName} was born from a love of the jhumka — the earring that has swung from the ears of queens, dancers, and brides across India for centuries.</p>
            <p>We work directly with artisans in Rajasthan who still shape, paint, and finish each pair by hand. From oxidised silver to hand-painted meenakari, no two are exactly alike.</p>
            <p className="font-hindi text-base" style={{ color: 'var(--maroon)' }}>{settings.slogan} — {settings.sloganEnglish}.</p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/products" className="btn-maroon">Shop the Collection</Link>
            <WhatsAppButton label="Chat with us" />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section" style={{ background: 'color-mix(in srgb, var(--beige) 45%, var(--cream))' }}>
        <div className="container-wide grid grid-cols-2 md:grid-cols-4 gap-5">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl p-6 bg-white shadow-card text-center">
              <div className="w-12 h-12 rounded-full grid place-items-center mx-auto mb-3" style={{ background: 'color-mix(in srgb, var(--gold) 18%, transparent)' }}>
                <Icon size={20} style={{ color: 'var(--maroon)' }} />
              </div>
              <h3 className="font-display text-lg" style={{ color: 'var(--ink)' }}>{title}</h3>
              <p className="text-xs text-stone-500 mt-1">{text.replace('{city}', settings.freeShippingCity)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
