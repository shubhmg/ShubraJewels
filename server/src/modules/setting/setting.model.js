import mongoose from 'mongoose';

// Default homepage = editable hero + an ordered list of composable BLOCKS.
// Mirrors the original hardcoded design so nothing changes until edited.
export const DEFAULT_HOMEPAGE = {
  hero: {
    eyebrow: '',
    slogan: '',
    heading: '',
    subheading: 'Every jhumka tells a story — handcrafted royal jhumkas inspired by the heritage of Rajasthan.',
    ctaLabel: 'Shop Jhumkas',
    ctaLink: '/products',
    showWhatsapp: true,
    background: 'jewel', // 'jewel' (3D) | 'image' | 'video'
    mediaUrl: '',
  },
  blocks: [
    { id: 'seed-banners', type: 'banners', enabled: true, config: {} },
    { id: 'seed-categories', type: 'categories', enabled: true, config: { eyebrow: 'Shop by Category', title: 'Find Your Jhumka', hindi: 'अपनी पसंद चुनें', subtitle: '' } },
    { id: 'seed-featured', type: 'productGrid', enabled: true, config: { eyebrow: 'Bestsellers', title: 'Loved by Our Customers', hindi: 'सबसे पसंदीदा', subtitle: 'Each jhumka carries a name and a story.', source: 'featured', limit: 8, dark: false } },
    { id: 'seed-story', type: 'story', enabled: true, config: {} },
    { id: 'seed-collections', type: 'collections', enabled: true, config: { eyebrow: 'Signature Collections', title: 'The Royal Collections', hindi: 'राजसी संग्रह', subtitle: 'Maharani, Rajputana, Banjara & more — worlds of their own.' } },
    { id: 'seed-under599', type: 'productGrid', enabled: true, config: { eyebrow: 'Budget Beauties', title: 'Under ₹599', hindi: '₹599 से कम', subtitle: '', source: 'under599', limit: 4, dark: true } },
    { id: 'seed-videos', type: 'videos', enabled: true, config: { eyebrow: 'Watch', title: 'Jhumkas in Motion', hindi: 'हमारी दुनिया', subtitle: '' } },
    { id: 'seed-reviews', type: 'reviews', enabled: true, config: { eyebrow: 'Kind Words', title: 'Customer Reviews', hindi: 'ग्राहकों की राय', subtitle: '' } },
    { id: 'seed-gallery', type: 'gallery', enabled: true, config: { eyebrow: '#ShubraGirls', title: 'Customer Gallery', hindi: 'हमारा परिवार', subtitle: 'Our jhumkas, your moments.' } },
  ],
};

/**
 * Single document holding all global, admin-editable site settings.
 * Theme colours are stored here and injected as CSS variables on the storefront,
 * so the whole palette is editable without a code change.
 */
const settingSchema = new mongoose.Schema(
  {
    brandName: { type: String, default: 'Shubra Jewels' },
    brandNameHindi: { type: String, default: 'शुभ्रा' },
    slogan: { type: String, default: 'हर झुमका एक कहानी' },
    sloganEnglish: { type: String, default: 'Every jhumka tells a story' },
    logo: { type: String, default: '' },
    showBrandName: { type: Boolean, default: true },

    // Rotating Hindi taglines shown around the site
    taglines: { type: [String], default: ['हर झुमका एक कहानी', 'राजस्थान की शान', 'हर रंग में परंपरा'] },

    // Announcement strip at the very top
    announcement: { type: String, default: 'Free shipping in Delhi • Korean earrings free on select orders' },
    announcementActive: { type: Boolean, default: true },

    // Ordering / contact
    whatsappNumber: { type: String, default: '' }, // e.g. 919812345678 (country code, no +)
    whatsappMessage: { type: String, default: 'Hello! I would like to order:' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    freeShippingCity: { type: String, default: 'Delhi' },
    shippingNote: { type: String, default: 'Fast, tracked delivery across India.' },

    // Delivery charges — city is chosen from `cities` at checkout (deterministic).
    shipping: {
      cities: { type: [{ name: String, charge: Number }], default: [{ name: 'Delhi', charge: 0 }] },
      defaultCharge: { type: Number, default: 0 }, // fee for "Other city" not in the list
      freeAboveSubtotal: { type: Number, default: 0 }, // free everywhere above this (0 = off)
    },

    // Socials
    instagram: { type: String, default: '' },
    instagramUrl: { type: String, default: '' },
    facebook: { type: String, default: '' },
    youtube: { type: String, default: '' },

    // Theme tokens (Indian palette: maroon / beige / gold)
    theme: {
      maroon: { type: String, default: '#7B1E2B' },
      maroonDark: { type: String, default: '#5A121C' },
      gold: { type: String, default: '#C9A84C' },
      goldLight: { type: String, default: '#E3C97A' },
      beige: { type: String, default: '#F6ECD9' },
      cream: { type: String, default: '#FBF6EC' },
      ink: { type: String, default: '#2A1A16' },
    },

    // Free-form key facts for footer / about
    aboutShort: { type: String, default: 'Handcrafted jhumkas inspired by the royal heritage of Rajasthan.' },

    // "Our Story" (About) page — fully editable. `{brand}` in paragraphs is
    // replaced with the brand name at render.
    about: {
      eyebrow: { type: String, default: 'Rooted in Rajasthan' },
      heading: { type: String, default: 'Where every jhumka begins' },
      image: { type: String, default: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=85' },
      paragraphs: {
        type: [String],
        default: [
          '{brand} was born from a love of the jhumka — the earring that has swung from the ears of queens, dancers, and brides across India for centuries.',
          'We work directly with artisans in Rajasthan who still shape, paint, and finish each pair by hand. From oxidised silver to hand-painted meenakari, no two are exactly alike.',
        ],
      },
      values: {
        type: [{ icon: String, title: String, text: String }],
        default: [
          { icon: 'HandHeart', title: 'Handcrafted', text: 'Every jhumka is made by hand by Rajasthani artisans.' },
          { icon: 'Sparkles', title: 'A Story Each', text: 'Every design carries a name and a story of its own.' },
          { icon: 'Truck', title: 'Delivered with Care', text: 'Carefully packed and shipped across India.' },
          { icon: 'ShieldCheck', title: 'Quality Promise', text: 'Skin-friendly, long-lasting finish on every pair.' },
        ],
      },
    },

    // Which checkout payment methods are offered
    payments: {
      razorpay: { type: Boolean, default: true }, // pay online
      cod: { type: Boolean, default: true },       // pay on delivery
    },

    // Fully admin-editable homepage layout (hero + ordered sections)
    homepage: {
      hero: {
        eyebrow: { type: String, default: '' },
        slogan: { type: String, default: '' },
        heading: { type: String, default: '' },
        subheading: { type: String, default: DEFAULT_HOMEPAGE.hero.subheading },
        ctaLabel: { type: String, default: DEFAULT_HOMEPAGE.hero.ctaLabel },
        ctaLink: { type: String, default: DEFAULT_HOMEPAGE.hero.ctaLink },
        showWhatsapp: { type: Boolean, default: true },
        background: { type: String, default: 'jewel' },
        mediaUrl: { type: String, default: '' },
      },
      // Flexible block list — config shape varies by block type (see homepageDefault.js).
      blocks: { type: [mongoose.Schema.Types.Mixed], default: () => DEFAULT_HOMEPAGE.blocks },
    },
  },
  { timestamps: true }
);

const Setting = mongoose.model('Setting', settingSchema);

// Always work with a single settings doc.
export async function getSettings() {
  let doc = await Setting.findOne();
  if (!doc) doc = await Setting.create({});
  return doc;
}

export default Setting;
