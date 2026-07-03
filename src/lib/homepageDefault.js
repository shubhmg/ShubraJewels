// Default homepage layout (mirrors server setting.model DEFAULT_HOMEPAGE).
// Order of `sections` = render order. Used as a fallback + as the admin editor seed.
export const DEFAULT_HOMEPAGE = {
  hero: {
    subheading: 'Every jhumka tells a story — handcrafted royal jhumkas inspired by the heritage of Rajasthan.',
    ctaLabel: 'Shop Jhumkas',
    ctaLink: '/products',
    showWhatsapp: true,
    background: 'jewel', // 'jewel' (3D) | 'image' | 'video'
    mediaUrl: '',
  },
  sections: [
    { key: 'offers', enabled: true, eyebrow: '', title: '', hindi: '', subtitle: '' },
    { key: 'categories', enabled: true, eyebrow: 'Shop by Category', title: 'Find Your Jhumka', hindi: 'अपनी पसंद चुनें', subtitle: '' },
    { key: 'featured', enabled: true, eyebrow: 'Bestsellers', title: 'Loved by Our Customers', hindi: 'सबसे पसंदीदा', subtitle: 'Each jhumka carries a name and a story.' },
    { key: 'story', enabled: true, eyebrow: '', title: '', hindi: '', subtitle: '' },
    { key: 'collections', enabled: true, eyebrow: 'Signature Collections', title: 'The Royal Collections', hindi: 'राजसी संग्रह', subtitle: 'Maharani, Rajputana, Banjara & more — worlds of their own.' },
    { key: 'under599', enabled: true, eyebrow: 'Budget Beauties', title: 'Under ₹599', hindi: '₹599 से कम', subtitle: '' },
    { key: 'videos', enabled: true, eyebrow: 'Watch', title: 'Jhumkas in Motion', hindi: 'हमारी दुनिया', subtitle: '' },
    { key: 'reviews', enabled: true, eyebrow: 'Kind Words', title: 'Customer Reviews', hindi: 'ग्राहकों की राय', subtitle: '' },
    { key: 'gallery', enabled: true, eyebrow: '#ShubraGirls', title: 'Customer Gallery', hindi: 'हमारा परिवार', subtitle: 'Our jhumkas, your moments.' },
  ],
}

// Friendly labels for the admin editor (by section key).
export const SECTION_LABELS = {
  offers: 'Offer banners',
  categories: 'Categories',
  featured: 'Featured jhumkas',
  story: 'Story spotlight',
  collections: 'Royal collections',
  under599: 'Under ₹599',
  videos: 'Videos',
  reviews: 'Customer reviews',
  gallery: 'Customer gallery',
}

// Which sections have editable headings (offers/story render without a heading block).
export const SECTIONS_WITH_HEADINGS = ['categories', 'featured', 'collections', 'under599', 'videos', 'reviews', 'gallery']
