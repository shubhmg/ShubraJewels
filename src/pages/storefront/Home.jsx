import { lazy, Suspense, Fragment, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Truck, Gift, Star, Quote } from 'lucide-react'
import { ProductCard } from '../../components/product/ProductCard.jsx'
import { WhatsAppButton } from '../../components/ui/WhatsAppButton.jsx'
import { SectionHeading } from '../../components/ui/SectionHeading.jsx'
import { Mandala, MehendiDivider, TempleFrame, Motif } from '../../components/decor/Decor.jsx'
import { Reveal, Stagger, StaggerItem, Tilt, Magnetic } from '../../components/motion/Motion.jsx'
import { useSettings } from '../../lib/SettingsProvider.jsx'

// Three.js hero is heavy — code-split it so it doesn't bloat the main bundle.
const HeroJewel = lazy(() => import('../../components/motion/HeroJewel.jsx').then((m) => ({ default: m.HeroJewel })))
import {
  useProducts, useCategories, useCollections, useBanners, useVideos, useReviews, useGallery,
} from '../../hooks/useApi.js'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)

const heroLineVar = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }
function HeroLine({ children }) {
  return <motion.div variants={heroLineVar}>{children}</motion.div>
}

export function Home() {
  const settings = useSettings()
  const { data: products } = useProducts()
  const { data: categories } = useCategories()
  const { data: collections } = useCollections()
  const { data: banners } = useBanners()
  const { data: videos } = useVideos()
  const { data: reviews } = useReviews()
  const { data: gallery } = useGallery()

  const all = products || []
  // The 3D jewel is the hero now, so every video (including the old hero video)
  // shows in the "Jhumkas in Motion" section.
  const otherVideos = videos || []
  const offers = (banners || []).filter((b) => b.placement === 'offer')
  const featured = all.filter((p) => p.isBestseller).slice(0, 8)
  const showFeatured = featured.length ? featured : all.slice(0, 8)
  const under599 = all.filter((p) => p.price <= 599).slice(0, 4)
  const spotlight = all.find((p) => p.story)

  // Each section keyed for admin-controlled order + enable + headings.
  const renderers = {
    offers: () => (offers.length > 0 ? <OfferStrip offers={offers} /> : null),
    categories: (h) => (categories?.length > 0 ? <CategoryGrid categories={categories} h={h} /> : null),
    featured: (h) => (showFeatured.length > 0 ? <FeaturedJhumkas products={showFeatured} h={h} /> : null),
    story: () => (spotlight ? <StorySpotlight product={spotlight} settings={settings} /> : null),
    collections: (h) => (collections?.length > 0 ? <RoyalCollections collections={collections} h={h} /> : null),
    under599: (h) => (under599.length > 0 ? <Under599 products={under599} h={h} /> : null),
    videos: (h) => (otherVideos.length > 0 ? <VideoSection videos={otherVideos} h={h} /> : null),
    reviews: (h) => (reviews?.length > 0 ? <Reviews reviews={reviews} h={h} /> : null),
    gallery: (h) => (gallery?.length > 0 ? <GalleryWall gallery={gallery} h={h} /> : null),
  }

  const sections = settings.homepage?.sections || []

  return (
    <div style={{ background: 'var(--cream)' }}>
      <Hero settings={settings} />

      {sections.filter((s) => s.enabled).map((s) => {
        const r = renderers[s.key]
        return r ? <Fragment key={s.key}>{r(s)}</Fragment> : null
      })}

      <SloganBand settings={settings} />
    </div>
  )
}

/* ── Hero ─────────────────────────────────────────────────────────── */
function Hero({ settings }) {
  const t = settings.theme || {}
  const hero = settings.homepage?.hero || {}
  return (
    <section className="relative min-h-[94vh] flex flex-col overflow-hidden" style={{ background: 'var(--maroon-dark)' }}>
      <Mandala size={560} className="absolute -right-44 -top-28 opacity-25" />
      <Mandala size={380} className="absolute -left-32 bottom-10 opacity-15" />

      {/* Hero background — 3D jewel, image, or video (admin-selectable) */}
      <div className="relative flex-1 min-h-[40vh] md:min-h-[48vh]">
        <HeroBackground hero={hero} t={t} />
      </div>

      {/* Text */}
      <motion.div
        className="container-wide relative z-10 pb-24 pt-2 text-center"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }}
      >
        <HeroLine><div className="eyebrow justify-center flex mb-4"><Motif size={20} />{settings.brandNameHindi} • {settings.freeShippingCity} में फ्री शिपिंग</div></HeroLine>
        <HeroLine><p className="font-hindi text-2xl md:text-3xl text-[var(--gold-light)]">{settings.slogan}</p></HeroLine>
        <HeroLine><h1 className="font-display text-white text-5xl md:text-7xl lg:text-8xl leading-[1.03] mt-2 tracking-tight">{settings.brandName}</h1></HeroLine>
        {hero.subheading && <HeroLine><p className="text-white/80 max-w-xl mx-auto mt-4 text-base md:text-lg">{hero.subheading}</p></HeroLine>}
        <HeroLine>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <Magnetic><Link to={hero.ctaLink || '/products'} className="btn-gold">{hero.ctaLabel || 'Shop Jhumkas'} <ArrowRight size={17} /></Link></Magnetic>
            {hero.showWhatsapp !== false && <Magnetic><WhatsAppButton label="Order on WhatsApp" size="md" className="!px-6 !py-3" /></Magnetic>}
          </div>
        </HeroLine>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0"><MehendiDivider /></div>
    </section>
  )
}

// Hero background switch: 3D jewel (default), an uploaded image, or a video.
function HeroBackground({ hero, t }) {
  const bg = hero.background || 'jewel'
  const url = hero.mediaUrl || ''
  const videoRef = useRef(null)

  // Pause the hero video when scrolled off-screen.
  useEffect(() => {
    if (bg !== 'video') return
    const el = videoRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) el.play().catch(() => {}); else el.pause() },
      { threshold: 0.1 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [bg, url])

  if (bg === 'image' && url) {
    return (
      <>
        <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 45%, transparent, rgba(90,18,28,0.35) 80%)' }} />
      </>
    )
  }
  if (bg === 'video' && url) {
    return (
      <>
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" src={url} autoPlay muted loop playsInline />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 45%, transparent, rgba(90,18,28,0.35) 80%)' }} />
      </>
    )
  }
  // Default: 3D jewel
  return (
    <>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 55% at 50% 45%, color-mix(in srgb, var(--gold) 22%, transparent), transparent 70%)' }} />
      <Suspense fallback={null}>
        <HeroJewel gold={t.gold || '#C9A84C'} goldLight={t.goldLight || '#E3C97A'} className="absolute inset-0" />
      </Suspense>
    </>
  )
}

/* ── Offer strip ──────────────────────────────────────────────────── */
function OfferStrip({ offers }) {
  return (
    <section className="container-wide -mt-8 relative z-20">
      <div className="grid md:grid-cols-2 gap-4">
        {offers.slice(0, 2).map((o, i) => (
          <div
            key={o._id}
            className="relative rounded-2xl overflow-hidden p-6 md:p-7 flex items-center gap-4 shadow-card animate-slide-up"
            style={{ background: o.bgColor || (i === 0 ? 'var(--maroon)' : 'var(--gold)'), color: i === 0 ? 'var(--cream)' : 'var(--ink)' }}
          >
            <div className="shrink-0 w-12 h-12 rounded-full grid place-items-center" style={{ background: 'rgba(255,255,255,0.18)' }}>
              {i === 0 ? <Gift size={22} /> : <Truck size={22} />}
            </div>
            <div className="flex-1">
              {o.hindiText && <p className="font-hindi text-sm opacity-90">{o.hindiText}</p>}
              <p className="font-display text-xl md:text-2xl leading-tight">{o.text}</p>
              {o.subtext && <p className="text-sm opacity-85 mt-0.5">{o.subtext}</p>}
            </div>
            {o.ctaLabel && (
              <Link to={o.ctaLink || '/products'} className="shrink-0 text-sm font-semibold underline underline-offset-4">
                {o.ctaLabel}
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Categories ───────────────────────────────────────────────────── */
function CategoryGrid({ categories, h = {} }) {
  return (
    <section className="section container-wide">
      <Reveal><SectionHeading eyebrow={h.eyebrow} hindi={h.hindi} title={h.title} subtitle={h.subtitle} /></Reveal>
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
        {categories.map((c) => (
          <StaggerItem key={c._id}>
            <Tilt max={7}>
              <Link to={`/products?category=${c.slug || c._id}`} className="group relative block aspect-[4/5] rounded-2xl overflow-hidden shadow-card">
                {c.image
                  ? <img src={c.image} alt={c.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  : <div className="w-full h-full" style={{ background: 'var(--beige)' }} />}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(42,26,22,0.8) 100%)' }} />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                  {c.hindiName && <p className="font-hindi text-[var(--gold-light)] text-sm">{c.hindiName}</p>}
                  <p className="font-display text-white text-lg leading-tight">{c.name}</p>
                </div>
              </Link>
            </Tilt>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}

/* ── Featured jhumkas ─────────────────────────────────────────────── */
function FeaturedJhumkas({ products, h = {} }) {
  return (
    <section className="section" style={{ background: 'color-mix(in srgb, var(--beige) 45%, var(--cream))' }}>
      <div className="container-wide">
        <Reveal><SectionHeading eyebrow={h.eyebrow} hindi={h.hindi} title={h.title} subtitle={h.subtitle} /></Reveal>
        <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7">
          {products.map((p) => <StaggerItem key={p.id}><ProductCard product={p} /></StaggerItem>)}
        </Stagger>
        <Reveal delay={0.1}>
          <div className="text-center mt-12">
            <Magnetic><Link to="/products" className="btn-outline-gold">View All Jhumkas <ArrowRight size={16} /></Link></Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ── Story spotlight (हर झुमका एक कहानी) ──────────────────────────── */
function StorySpotlight({ product, settings }) {
  return (
    <section className="section relative overflow-hidden" style={{ background: 'var(--maroon)' }}>
      <Mandala size={460} className="absolute -left-32 -bottom-24 opacity-20" />
      <div className="container-wide relative grid md:grid-cols-2 gap-10 md:gap-14 items-center">
        <Reveal>
          <Tilt max={6}>
            <TempleFrame className="aspect-[4/5] max-w-sm mx-auto w-full shadow-glass-lg">
              <img src={product.images?.[0]} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </TempleFrame>
          </Tilt>
        </Reveal>
        <Reveal delay={0.1} className="text-center md:text-left">
          <div className="eyebrow"><Motif size={18} />{settings.slogan}</div>
          {product.hindiName && <p className="font-hindi text-[var(--gold-light)] text-xl mt-3">{product.hindiName}</p>}
          <h2 className="font-display text-white text-4xl md:text-5xl mt-1">{product.name}</h2>
          <p className="text-white/80 mt-5 leading-relaxed max-w-lg">{product.story}</p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-8">
            <Magnetic><Link to={`/products/${product.id}`} className="btn-gold">Discover the Story <ArrowRight size={16} /></Link></Magnetic>
            <span className="font-display text-2xl text-[var(--gold-light)]">{fmt(product.price)}</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ── Royal collections ────────────────────────────────────────────── */
function RoyalCollections({ collections, h = {} }) {
  return (
    <section className="section container-wide">
      <Reveal><SectionHeading eyebrow={h.eyebrow} hindi={h.hindi} title={h.title} subtitle={h.subtitle} /></Reveal>
      <Stagger className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {collections.map((c) => (
          <StaggerItem key={c._id}>
            <Tilt max={8}>
              <Link to={`/products?collection=${c.slug || c._id}`} className="group relative block aspect-[3/4] rounded-3xl overflow-hidden shadow-card">
                {c.image
                  ? <img src={c.image} alt={c.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  : <div className="w-full h-full" style={{ background: c.accentColor }} />}
                <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 30%, ${c.accentColor}cc 100%)` }} />
                <div className="absolute inset-x-0 bottom-0 p-5 text-center">
                  {c.hindiName && <p className="font-hindi text-white/90 text-base">{c.hindiName}</p>}
                  <h3 className="font-display text-white text-2xl md:text-3xl leading-tight">{c.name}</h3>
                  {c.tagline && <p className="text-white/80 text-xs mt-1 italic">{c.tagline}</p>}
                </div>
              </Link>
            </Tilt>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}

/* ── Under 599 ────────────────────────────────────────────────────── */
function Under599({ products, h = {} }) {
  return (
    <section className="section" style={{ background: 'var(--ink)' }}>
      <div className="container-wide">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            {h.eyebrow && <div className="eyebrow"><Motif size={18} />{h.eyebrow}</div>}
            {h.hindi && <p className="font-hindi text-[var(--gold-light)] text-lg mt-2">{h.hindi}</p>}
            <h2 className="font-display text-white text-3xl md:text-5xl">{h.title || 'Under ₹599'}</h2>
          </div>
          <Magnetic><Link to="/products?under599=1" className="btn-outline-gold">See All <ArrowRight size={16} /></Link></Magnetic>
        </div>
        <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7">
          {products.map((p) => <StaggerItem key={p.id}><ProductCard product={p} /></StaggerItem>)}
        </Stagger>
      </div>
    </section>
  )
}

/* ── Videos ───────────────────────────────────────────────────────── */
function VideoSection({ videos, h = {} }) {
  return (
    <section className="section container-wide">
      <Reveal><SectionHeading eyebrow={h.eyebrow} hindi={h.hindi} title={h.title} subtitle={h.subtitle} /></Reveal>
      <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {videos.map((v) => (
          <StaggerItem key={v._id}><figure className="rounded-2xl overflow-hidden shadow-card bg-black">
            <video className="w-full aspect-video object-cover" src={v.src} poster={v.poster} controls playsInline preload="none" />
            {(v.title || v.caption) && (
              <figcaption className="p-3" style={{ background: 'var(--beige)' }}>
                {v.title && <p className="font-display text-lg" style={{ color: 'var(--ink)' }}>{v.title}</p>}
                {v.caption && <p className="text-xs text-stone-500">{v.caption}</p>}
              </figcaption>
            )}
          </figure></StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}

/* ── Reviews ──────────────────────────────────────────────────────── */
function Reviews({ reviews, h = {} }) {
  return (
    <section className="section" style={{ background: 'color-mix(in srgb, var(--beige) 55%, var(--cream))' }}>
      <div className="container-wide">
        <Reveal><SectionHeading eyebrow={h.eyebrow} hindi={h.hindi} title={h.title} subtitle={h.subtitle} /></Reveal>
        <Stagger className="grid md:grid-cols-3 gap-5">
          {reviews.slice(0, 6).map((r) => (
            <StaggerItem key={r._id}><div className="rounded-2xl p-6 bg-white shadow-card relative h-full">
              <Quote size={28} className="absolute top-5 right-5 opacity-10" style={{ color: 'var(--maroon)' }} />
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={15} className={i < r.rating ? 'fill-current' : ''} style={{ color: i < r.rating ? 'var(--gold)' : '#d6d3d1' }} />
                ))}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>“{r.text}”</p>
              <div className="mt-4 flex items-center gap-3">
                {r.image
                  ? <img src={r.image} alt={r.name} className="w-9 h-9 rounded-full object-cover" />
                  : <div className="w-9 h-9 rounded-full grid place-items-center font-display text-sm" style={{ background: 'var(--maroon)', color: 'var(--cream)' }}>{r.name?.[0]}</div>}
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{r.name}</p>
                  {r.location && <p className="text-xs text-stone-400">{r.location}</p>}
                </div>
              </div>
            </div></StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

/* ── Customer gallery ─────────────────────────────────────────────── */
function GalleryWall({ gallery, h = {} }) {
  return (
    <section className="section container-wide">
      <Reveal><SectionHeading eyebrow={h.eyebrow} hindi={h.hindi} title={h.title} subtitle={h.subtitle} /></Reveal>
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {gallery.map((g) => (
          <StaggerItem key={g._id}><Tilt max={9} className="group relative block aspect-square rounded-2xl overflow-hidden shadow-card">
            <img src={g.image} alt={g.caption || g.customerName} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            {(g.caption || g.customerName) && (
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3" style={{ background: 'linear-gradient(180deg, transparent, rgba(42,26,22,0.75))' }}>
                <p className="text-white text-xs">
                  {g.customerName && <span className="font-semibold">{g.customerName}</span>}
                  {g.caption && <span className="block opacity-90">{g.caption}</span>}
                </p>
              </div>
            )}
          </Tilt></StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}

/* ── Slogan band ──────────────────────────────────────────────────── */
function SloganBand({ settings }) {
  return (
    <section className="relative py-20 md:py-28 text-center overflow-hidden" style={{ background: 'var(--maroon-dark)' }}>
      <Mandala size={420} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15" />
      <div className="container-tight relative">
        <Motif size={34} className="mx-auto" />
        <p className="font-hindi text-3xl md:text-5xl text-white mt-4">{settings.slogan}</p>
        <p className="text-[var(--gold-light)] mt-3 tracking-widest uppercase text-sm">{settings.sloganEnglish}</p>
        <div className="mt-8 flex justify-center">
          <WhatsAppButton label="Order on WhatsApp" className="!px-7 !py-3.5" />
        </div>
      </div>
    </section>
  )
}
