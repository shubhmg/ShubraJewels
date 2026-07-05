import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ProductCard } from '../../components/product/ProductCard.jsx'
import { Mandala, Motif, MehendiDivider } from '../../components/decor/Decor.jsx'
import { SectionHeading } from '../../components/ui/SectionHeading.jsx'
import { useCollections, useProducts } from '../../hooks/useApi.js'
import { useSettings } from '../../lib/SettingsProvider.jsx'

export function Collections() {
  const settings = useSettings()
  const { data: collections } = useCollections()
  const { data: products } = useProducts()

  const cols = collections || []
  const newArrivals = (products || []).filter((p) => p.isNewArrival).slice(0, 4)

  const countFor = (colId) =>
    (products || []).filter((p) => (p.collectionIds || []).map(String).includes(String(colId))).length

  return (
    <div className="pt-16 min-h-dvh animate-fade-in" style={{ background: 'var(--cream)' }}>
      {/* Hero */}
      <div className="relative overflow-hidden text-center" style={{ background: 'var(--maroon-dark)' }}>
        <Mandala size={440} className="absolute left-1/2 -translate-x-1/2 -top-24 opacity-20" />
        <div className="container-wide py-20 relative">
          <div className="eyebrow justify-center flex"><Motif size={20} /><span className="font-hindi">{settings.brandNameHindi}</span></div>
          <p className="font-hindi text-2xl text-[var(--gold-light)] mt-3">राजसी संग्रह</p>
          <h1 className="font-display text-white text-5xl md:text-6xl leading-tight mt-1">The Royal Collections</h1>
          <p className="mt-4 text-white/70 max-w-lg mx-auto text-sm">
            Every collection is a world of its own — Maharani, Rajputana, Banjara & more. {settings.slogan}
          </p>
        </div>
        <MehendiDivider />
      </div>

      {/* Alternating collection features */}
      <section className="section">
        <div className="container-wide space-y-8">
          {cols.map((c, i) => {
            const isEven = i % 2 === 0
            const count = countFor(c._id)
            return (
              <div key={c._id} className="rounded-3xl overflow-hidden shadow-card" style={{ background: 'white' }}>
                <div className={`grid md:grid-cols-2 gap-0 md:max-h-[380px] ${isEven ? '' : 'md:[&>*:first-child]:order-2'}`}>
                  <div className="relative aspect-[4/3] max-h-[280px] md:max-h-none md:aspect-auto md:h-[380px] overflow-hidden">
                    {c.image
                      ? <img src={c.image} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full" style={{ background: c.accentColor }} />}
                    <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 50%, ${c.accentColor}bb 100%)` }} />
                    {count > 0 && (
                      <span className="absolute bottom-4 left-4 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'var(--gold)', color: 'var(--ink)' }}>
                        {count} {count === 1 ? 'design' : 'designs'}
                      </span>
                    )}
                  </div>
                  <div className="p-8 md:p-12 flex flex-col justify-center">
                    <div className="w-10 h-1 rounded-full mb-4" style={{ background: c.accentColor }} />
                    {c.hindiName && <p className="font-hindi text-xl mb-1" style={{ color: c.accentColor }}>{c.hindiName}</p>}
                    <h2 className="font-display text-4xl leading-tight mb-2" style={{ color: 'var(--ink)' }}>{c.name}</h2>
                    {c.tagline && <p className="text-sm italic mb-4" style={{ color: 'var(--maroon)' }}>{c.tagline}</p>}
                    {c.description && <p className="text-stone-500 leading-relaxed text-sm mb-6">{c.description}</p>}
                    <Link to={`/products?collection=${c.slug || c._id}`} className="inline-flex items-center gap-2 font-semibold group" style={{ color: 'var(--maroon)' }}>
                      Explore {c.name}
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* New arrivals */}
      {newArrivals.length > 0 && (
        <section className="section" style={{ background: 'color-mix(in srgb, var(--beige) 45%, var(--cream))' }}>
          <div className="container-wide">
            <SectionHeading eyebrow="Just In" hindi="नए झुमके" title="New Arrivals" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
              {newArrivals.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
