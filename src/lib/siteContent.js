// Editable site-wide copy (navigation, footer, page headings, buttons).
// Kept in sync with the `content` block in server setting.model.js. Everything
// falls back to these defaults, so the site renders unchanged until edited.

export const CONTENT_DEFAULTS = {
  nav: [
    { label: 'Collections', to: '/collections' },
    { label: 'Jhumkas', to: '/products' },
    { label: 'Our Story', to: '/about' },
    { label: 'Contact', to: '/contact' },
  ],
  footer: {
    companyHeading: 'Company',
    reachHeading: 'Reach Us',
    copyright: '', // empty = "© <year> <brand>. <slogan>"
    links: [
      { label: 'Collections', to: '/collections' },
      { label: 'Our Story', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Wishlist', to: '/wishlist' },
    ],
  },
  home: {
    ctaViewAll: 'View All Jhumkas',
    ctaStory: 'Discover the Story',
    ctaSeeAll: 'See All',
  },
  product: {
    packagingNote: 'Gift-ready packaging',
    addToBag: 'Add to Bag',
    soldOut: 'Sold Out',
  },
  pages: {
    about: { eyebrow: 'Our Story' },
    products: {
      eyebrow: 'Browse the collection',
      titleAll: 'All Jhumkas', hindiAll: 'सभी झुमके',
      titleUnder599: 'Under ₹599', hindiUnder599: '₹599 से कम',
    },
    collections: {
      hindi: 'राजसी संग्रह', heading: 'The Royal Collections',
      naEyebrow: 'Just In', naHindi: 'नए झुमके', naTitle: 'New Arrivals',
    },
    contact: {
      eyebrow: 'Get in touch', hindi: 'हमसे जुड़ें', heading: "We'd Love to Hear From You",
      waHeading: 'Message us on WhatsApp', waSubtext: 'The fastest way to order or ask a question.',
    },
  },
}

// Merge stored content over the defaults so partial/missing data still renders.
export function resolveContent(content) {
  const c = content || {}
  const p = c.pages || {}
  const merge = (key) => ({ ...CONTENT_DEFAULTS.pages[key], ...(p[key] || {}) })
  return {
    nav: c.nav?.length ? c.nav : CONTENT_DEFAULTS.nav,
    footer: {
      ...CONTENT_DEFAULTS.footer,
      ...(c.footer || {}),
      links: c.footer?.links?.length ? c.footer.links : CONTENT_DEFAULTS.footer.links,
    },
    home: { ...CONTENT_DEFAULTS.home, ...(c.home || {}) },
    product: { ...CONTENT_DEFAULTS.product, ...(c.product || {}) },
    pages: {
      about: merge('about'),
      products: merge('products'),
      collections: merge('collections'),
      contact: merge('contact'),
    },
  }
}
