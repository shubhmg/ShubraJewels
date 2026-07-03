// Homepage = an editable hero + an ordered list of BLOCKS the admin composes.
// Each block: { id, type, enabled, config }. Order = render order. Multiples allowed.

let _id = 0
const uid = () => `b${Date.now().toString(36)}${(_id++).toString(36)}`

// Block palette shown in the admin "Add block" menu, with default config.
export const BLOCK_TYPES = {
  productGrid: {
    label: 'Product grid',
    hint: 'A row of jhumkas from a source you choose',
    defaults: { eyebrow: '', title: 'Our Jhumkas', hindi: '', subtitle: '', source: 'featured', categoryId: '', collectionId: '', maxPrice: 599, limit: 8, dark: false },
  },
  categories: { label: 'Category tiles', hint: 'The “shop by category” grid', defaults: { eyebrow: 'Shop by Category', title: 'Find Your Jhumka', hindi: 'अपनी पसंद चुनें', subtitle: '' } },
  collections: { label: 'Collections showcase', hint: 'The royal-collection cards', defaults: { eyebrow: 'Signature Collections', title: 'The Royal Collections', hindi: 'राजसी संग्रह', subtitle: 'Maharani, Rajputana, Banjara & more.' } },
  banners: { label: 'Offer banners', hint: 'Your active offer strips', defaults: {} },
  story: { label: 'Story spotlight', hint: 'One featured jhumka + its story', defaults: {} },
  videos: { label: 'Videos', hint: 'Your uploaded videos', defaults: { eyebrow: 'Watch', title: 'Jhumkas in Motion', hindi: 'हमारी दुनिया', subtitle: '' } },
  reviews: { label: 'Customer reviews', hint: 'Approved testimonials', defaults: { eyebrow: 'Kind Words', title: 'Customer Reviews', hindi: 'ग्राहकों की राय', subtitle: '' } },
  gallery: { label: 'Customer gallery', hint: 'The customer photo wall', defaults: { eyebrow: '#ShubraGirls', title: 'Customer Gallery', hindi: 'हमारा परिवार', subtitle: 'Our jhumkas, your moments.' } },
  image: { label: 'Image', hint: 'A full-width image (optionally clickable)', defaults: { url: '', link: '', caption: '' } },
  text: { label: 'Text / heading', hint: 'A headline or paragraph', defaults: { eyebrow: '', title: 'A heading', hindi: '', body: '', dark: false } },
}

export const PRODUCT_SOURCES = [
  { value: 'featured', label: 'Bestsellers / featured' },
  { value: 'new', label: 'New arrivals' },
  { value: 'under599', label: 'Under a price…' },
  { value: 'onSale', label: 'On sale' },
  { value: 'category', label: 'A category…' },
  { value: 'collection', label: 'A collection…' },
  { value: 'all', label: 'All products' },
]

export const makeBlock = (type) => ({ id: uid(), type, enabled: true, config: { ...(BLOCK_TYPES[type]?.defaults || {}) } })

// Default layout mirrors the original hardcoded homepage.
export const DEFAULT_HOMEPAGE = {
  hero: {
    subheading: 'Every jhumka tells a story — handcrafted royal jhumkas inspired by the heritage of Rajasthan.',
    ctaLabel: 'Shop Jhumkas',
    ctaLink: '/products',
    showWhatsapp: true,
    background: 'jewel',
    mediaUrl: '',
  },
  blocks: [
    { id: 'seed-banners', type: 'banners', enabled: true, config: {} },
    { id: 'seed-categories', type: 'categories', enabled: true, config: { ...BLOCK_TYPES.categories.defaults } },
    { id: 'seed-featured', type: 'productGrid', enabled: true, config: { eyebrow: 'Bestsellers', title: 'Loved by Our Customers', hindi: 'सबसे पसंदीदा', subtitle: 'Each jhumka carries a name and a story.', source: 'featured', limit: 8, dark: false } },
    { id: 'seed-story', type: 'story', enabled: true, config: {} },
    { id: 'seed-collections', type: 'collections', enabled: true, config: { ...BLOCK_TYPES.collections.defaults } },
    { id: 'seed-under599', type: 'productGrid', enabled: true, config: { eyebrow: 'Budget Beauties', title: 'Under ₹599', hindi: '₹599 से कम', subtitle: '', source: 'under599', limit: 4, dark: true } },
    { id: 'seed-videos', type: 'videos', enabled: true, config: { ...BLOCK_TYPES.videos.defaults } },
    { id: 'seed-reviews', type: 'reviews', enabled: true, config: { ...BLOCK_TYPES.reviews.defaults } },
    { id: 'seed-gallery', type: 'gallery', enabled: true, config: { ...BLOCK_TYPES.gallery.defaults } },
  ],
}
