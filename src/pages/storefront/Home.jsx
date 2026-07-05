import { lazy, Suspense, Fragment, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Truck, Gift, Star, Quote, Instagram } from 'lucide-react'
import { ProductCard } from '../../components/product/ProductCard.jsx'
import { SectionHeading } from '../../components/ui/SectionHeading.jsx'
import { Mandala, MehendiDivider, TempleFrame, Motif, EarringMotif } from '../../components/decor/Decor.jsx'
import { Reveal, Stagger, StaggerItem, Tilt, Magnetic } from '../../components/motion/Motion.jsx'
import { instagramHandle, instagramUrl, useSettings } from '../../lib/SettingsProvider.jsx'

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
  const otherVideos = videos || []
  const offers = (banners || []).filter((b) => b.placement === 'offer')
  const spotlight = all.find((p) => p.story)

  // Render one homepage block by its type + config.
  const renderBlock = (b) => {
    const c = b.config || {}
    switch (b.type) {
      case 'banners': return offers.length > 0 ? <OfferStrip offers={offers} /> : null
      case 'categories': return categories?.length > 0 ? <CategoryGrid categories={categories} h={c} /> : null
      case 'productGrid': return <ProductGridBlock all={all} config={c} />
      case 'story': return spotlight ? <StorySpotlight product={spotlight} settings={settings} /> : null
      case 'collections': return collections?.length > 0 ? <RoyalCollections collections={collections} h={c} /> : null
      case 'videos': return otherVideos.length > 0 ? <VideoSection videos={otherVideos} h={c} /> : null
      case 'reviews': return reviews?.length > 0 ? <Reviews reviews={reviews} h={c} /> : null
      case 'gallery': return gallery?.length > 0 ? <GalleryWall gallery={gallery} h={c} settings={settings} /> : null
      case 'image': return <ImageBlock config={c} />
      case 'text': return <TextBlock config={c} />
      default: return null
    }
  }

  const blocks = settings.homepage?.blocks || []

  return (
    <div style={{ background: 'var(--cream)' }}>
      <Hero settings={settings} />

      {blocks.filter((b) => b.enabled).map((b) => <Fragment key={b.id}>{renderBlock(b)}</Fragment>)}

      <SloganBand settings={settings} />
    </div>
  )
}

/* ── Product grid block (source-driven) ───────────────────────────── */
function ProductGridBlock({ all, config }) {
  const c = config || {}
  let list = [...all]
  switch (c.source) {
    case 'featured': { const f = all.filter((p) => p.isBestseller); list = f.length ? f : all; break }
    case 'new': list = all.filter((p) => p.isNewArrival); break
    case 'under599': list = all.filter((p) => p.price <= (Number(c.maxPrice) || 599)); break
    case 'onSale': list = all.filter((p) => p.mrp > p.price); break
    case 'category': list = all.filter((p) => String(p.categoryId) === String(c.categoryId)); break
    case 'collection': list = all.filter((p) => (p.collectionIds || []).map(String).includes(String(c.collectionId))); break
    default: break
  }
  list = list.slice(0, Number(c.limit) || 8)
  if (!list.length) return null
  const dark = c.dark
  return (
    <section className="section" style={{ background: dark ? 'var(--ink)' : 'color-mix(in srgb, var(--beige) 45%, var(--cream))' }}>
      <div className="container-wide">
        <Reveal><SectionHeading eyebrow={c.eyebrow} hindi={c.hindi} title={c.title} subtitle={c.subtitle} light={dark} /></Reveal>
        <Stagger className="product-masonry md:grid md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7">
          {list.map((p) => <StaggerItem key={p.id}><ProductCard product={p} /></StaggerItem>)}
        </Stagger>
      </div>
    </section>
  )
}

/* ── Image block ──────────────────────────────────────────────────── */
function ImageBlock({ config }) {
  const c = config || {}
  if (!c.url) return null
  const dark = c.dark
  const img = <img src={c.url} alt={c.caption || ''} loading="lazy" decoding="async" className="w-full h-auto rounded-2xl shadow-card" />
  return (
    <section className="section" style={dark ? { background: 'var(--ink)' } : undefined}>
      <div className="container-wide">
      <Reveal>
        {c.link ? <Link to={c.link}>{img}</Link> : img}
        {c.caption && <p className={`text-center text-sm mt-3 ${dark ? 'text-white/70' : 'text-stone-500'}`}>{c.caption}</p>}
      </Reveal>
      </div>
    </section>
  )
}

/* ── Text / heading block ─────────────────────────────────────────── */
function TextBlock({ config }) {
  const c = config || {}
  const dark = c.dark
  return (
    <section className="section" style={{ background: dark ? 'var(--maroon)' : 'transparent' }}>
      <div className="container-tight text-center">
        <Reveal>
          <SectionHeading eyebrow={c.eyebrow} hindi={c.hindi} title={c.title} light={dark} />
          {c.body && <p className={`-mt-6 ${dark ? 'text-white/80' : 'text-stone-600'} max-w-2xl mx-auto leading-relaxed`}>{c.body}</p>}
        </Reveal>
      </div>
    </section>
  )
}

/* ── Hero ─────────────────────────────────────────────────────────── */
function Hero({ settings }) {
  const t = settings.theme || {}
  const hero = settings.homepage?.hero || {}
  return (
    <section className="relative min-h-[68vh] md:min-h-[80vh] flex flex-col overflow-hidden pt-16 md:pt-20" style={{ background: 'var(--maroon-dark)' }}>
      {/* Scattered jhumka silhouettes (replaces the mandala) */}
      <EarringMotif size={150} className="absolute right-[7%] top-[9%] rotate-12" style={{ opacity: 0.1 }} />
      <EarringMotif size={95} className="absolute left-[8%] top-[22%] -rotate-12" style={{ opacity: 0.08 }} />
      <EarringMotif size={120} className="absolute left-[13%] bottom-[16%] rotate-6" style={{ opacity: 0.07 }} />
      <EarringMotif size={72} className="absolute right-[15%] bottom-[24%] -rotate-6" style={{ opacity: 0.09 }} />

      {/* Hero background — 3D jewel, image, or video (admin-selectable) */}
      <div className="relative flex-1 min-h-[30vh] md:min-h-[42vh]">
        <HeroBackground hero={hero} t={t} />
      </div>

      {/* Text */}
      <motion.div
        className="container-wide relative z-10 pb-10 md:pb-14 pt-2 text-center"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }}
      >
        <HeroLine><p className="font-hindi text-xl md:text-3xl text-[var(--gold-light)]">{hero.slogan || settings.slogan}</p></HeroLine>
        <HeroLine><h1 className="font-display text-white text-4xl md:text-6xl lg:text-7xl leading-[1.05] mt-1.5 tracking-tight">{hero.heading || settings.brandName}</h1></HeroLine>
        {hero.subheading && <HeroLine><p className="text-white/80 max-w-xl mx-auto mt-3 text-sm md:text-lg">{hero.subheading}</p></HeroLine>}
        <HeroLine>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
            <Magnetic><Link to={hero.ctaLink || '/products'} className="btn-gold !px-6 !py-2.5 !text-sm">{hero.ctaLabel || 'Shop Jhumkas'} <ArrowRight size={16} /></Link></Magnetic>
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

  // Fades the media's bottom edge into the maroon text block below (continuity).
  const bottomFade = <div className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, var(--maroon-dark) 96%)' }} />

  if (bg === 'image' && url) {
    return (
      <>
        <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 45%, transparent, rgba(90,18,28,0.35) 80%)' }} />
        {bottomFade}
      </>
    )
  }
  if (bg === 'video' && url) {
    return (
      <>
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" src={url} autoPlay muted loop playsInline />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 45%, transparent, rgba(90,18,28,0.35) 80%)' }} />
        {bottomFade}
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
    <section className="container-wide my-10 md:my-14 relative z-20">
      <div className="grid grid-cols-2 gap-2.5 md:gap-4">
        {offers.slice(0, 2).map((o, i) => (
          <div
            key={o._id}
            className="relative rounded-2xl overflow-hidden p-3 md:p-7 flex items-center gap-2.5 md:gap-4 shadow-card animate-slide-up"
            style={{ background: o.bgColor || (i === 0 ? 'var(--maroon)' : 'var(--gold)'), color: i === 0 ? 'var(--cream)' : 'var(--ink)' }}
          >
            <div className="shrink-0 w-8 h-8 md:w-12 md:h-12 rounded-full grid place-items-center" style={{ background: 'rgba(255,255,255,0.18)' }}>
              {i === 0 ? <Gift size={16} className="md:hidden" /> : <Truck size={16} className="md:hidden" />}
              {i === 0 ? <Gift size={22} className="hidden md:block" /> : <Truck size={22} className="hidden md:block" />}
            </div>
            <div className="flex-1 min-w-0">
              {o.hindiText && <p className="font-hindi text-[11px] md:text-sm opacity-90 truncate">{o.hindiText}</p>}
              <p className="font-display text-sm md:text-2xl leading-tight">{o.text}</p>
              {o.subtext && <p className="text-[11px] md:text-sm opacity-85 mt-0.5 line-clamp-2 md:line-clamp-none">{o.subtext}</p>}
            </div>
            {o.ctaLabel && (
              <Link to={o.ctaLink || '/products'} className="shrink-0 text-xs md:text-sm font-semibold underline underline-offset-4 hidden sm:inline">
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
  const dark = h.dark
  return (
    <section className="section" style={dark ? { background: 'var(--ink)' } : undefined}>
      <div className="container-wide">
      <Reveal><SectionHeading eyebrow={h.eyebrow} hindi={h.hindi} title={h.title} subtitle={h.subtitle} light={dark} /></Reveal>
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
      </div>
    </section>
  )
}

/* ── Featured jhumkas ─────────────────────────────────────────────── */
function FeaturedJhumkas({ products, h = {} }) {
  return (
    <section className="section" style={{ background: 'color-mix(in srgb, var(--beige) 45%, var(--cream))' }}>
      <div className="container-wide">
        <Reveal><SectionHeading eyebrow={h.eyebrow} hindi={h.hindi} title={h.title} subtitle={h.subtitle} /></Reveal>
        <Stagger className="product-masonry md:grid md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7">
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
          <div className="eyebrow"><Motif size={18} /><span className="font-hindi">{settings.slogan}</span></div>
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
  const dark = h.dark
  return (
    <section className="section" style={dark ? { background: 'var(--ink)' } : undefined}>
      <div className="container-wide">
      <Reveal><SectionHeading eyebrow={h.eyebrow} hindi={h.hindi} title={h.title} subtitle={h.subtitle} light={dark} /></Reveal>
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
        {collections.map((c) => (
          <StaggerItem key={c._id}>
            <Tilt max={8}>
              <Link to={`/products?collection=${c.slug || c._id}`} className="group relative block aspect-[4/5] rounded-2xl overflow-hidden shadow-card">
                {c.image
                  ? <img src={c.image} alt={c.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  : <div className="w-full h-full" style={{ background: c.accentColor }} />}
                <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 30%, ${c.accentColor}cc 100%)` }} />
                <div className="absolute inset-x-0 bottom-0 p-4 text-center">
                  {c.hindiName && <p className="font-hindi text-white/90 text-sm">{c.hindiName}</p>}
                  <h3 className="font-display text-white text-lg leading-tight">{c.name}</h3>
                  {c.tagline && <p className="text-white/80 text-[11px] mt-0.5 italic line-clamp-1">{c.tagline}</p>}
                </div>
              </Link>
            </Tilt>
          </StaggerItem>
        ))}
      </Stagger>
      </div>
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
        <Stagger className="product-masonry md:grid md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7">
          {products.map((p) => <StaggerItem key={p.id}><ProductCard product={p} /></StaggerItem>)}
        </Stagger>
      </div>
    </section>
  )
}

/* ── Videos ───────────────────────────────────────────────────────── */
function VideoSection({ videos, h = {} }) {
  const dark = h.dark
  return (
    <section className="section" style={dark ? { background: 'var(--ink)' } : undefined}>
      <div className="container-wide">
      <Reveal><SectionHeading eyebrow={h.eyebrow} hindi={h.hindi} title={h.title} subtitle={h.subtitle} light={dark} /></Reveal>
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
      </div>
    </section>
  )
}

/* ── Reviews ──────────────────────────────────────────────────────── */
function Reviews({ reviews, h = {} }) {
  const dark = h.dark
  return (
    <section className="section" style={{ background: dark ? 'var(--ink)' : 'color-mix(in srgb, var(--beige) 55%, var(--cream))' }}>
      <div className="container-wide">
        <Reveal><SectionHeading eyebrow={h.eyebrow} hindi={h.hindi} title={h.title} subtitle={h.subtitle} light={dark} /></Reveal>
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
function GalleryWall({ gallery, h = {}, settings }) {
  const igUrl = instagramUrl(settings)
  const handle = instagramHandle(settings)
  const dark = h.dark

  return (
    <section className="section" style={dark ? { background: 'var(--ink)' } : undefined}>
      <div className="container-wide">
      <Reveal>
        <div className="text-center mx-auto max-w-2xl mb-10 md:mb-14">
          {handle && (
            <a href={igUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide mb-4" style={{ background: 'var(--maroon)', color: 'var(--gold-light)' }}>
              <Instagram size={14} />
              {handle}
            </a>
          )}
          {h.hindi && <p className="font-hindi text-lg md:text-xl" style={{ color: dark ? 'var(--gold-light)' : 'var(--maroon)' }}>{h.hindi}</p>}
          <h2 className="font-display text-3xl md:text-5xl mt-1 leading-tight" style={{ color: dark ? '#fff' : 'var(--ink)' }}>{h.title || 'Styled by the Shubra Community'}</h2>
          <p className={`mt-3 text-sm md:text-base ${dark ? 'text-white/70' : 'text-stone-500'}`}>{h.subtitle || 'Customer moments, quietly gathered from our world.'}</p>
        </div>
      </Reveal>
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {gallery.map((g) => (
          <StaggerItem key={g._id}><GalleryTile item={g} /></StaggerItem>
        ))}
      </Stagger>
      </div>
    </section>
  )
}

function GalleryTile({ item }) {
  const productId = item.productId?._id || item.productId
  const hasProduct = !!productId
  const hasPost = !!item.link
  const productTo = hasProduct ? `/products/${productId}` : ''

  return (
    <Tilt max={9} className="group relative block aspect-square rounded-2xl overflow-hidden shadow-card bg-stone-100">
      <img src={item.image} alt={item.caption || item.customerName} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      {hasProduct && <Link to={productTo} aria-label="Shop this look" className="absolute inset-0 z-10" />}
      {!hasProduct && hasPost && <a href={item.link} target="_blank" rel="noopener noreferrer" aria-label="Open Instagram post" className="absolute inset-0 z-10" />}
      {hasPost && (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Instagram post"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full grid place-items-center bg-white/90 shadow-sm transition hover:bg-white"
          style={{ color: 'var(--maroon)' }}
        >
          <Instagram size={15} />
        </a>
      )}
      {(item.caption || item.customerName) && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent, rgba(42,26,22,0.75))' }}>
          <p className="text-white text-xs">
            {item.customerName && <span className="font-semibold">{item.customerName}</span>}
            {item.caption && <span className="block opacity-90">{item.caption}</span>}
          </p>
        </div>
      )}
      {hasProduct && (
        <span className="absolute left-2 bottom-2 z-20 rounded-full px-3 py-1 text-[11px] font-semibold opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: 'var(--maroon)', color: 'var(--gold-light)' }}>
          Shop this look
        </span>
      )}
    </Tilt>
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
      </div>
    </section>
  )
}
