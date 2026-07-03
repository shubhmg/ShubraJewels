import mongoose from 'mongoose';

// Default homepage layout — order of `sections` = render order on the site.
// Headings here mirror the original hardcoded design so nothing changes until edited.
export const DEFAULT_HOMEPAGE = {
  hero: {
    subheading: 'Every jhumka tells a story — handcrafted royal jhumkas inspired by the heritage of Rajasthan.',
    ctaLabel: 'Shop Jhumkas',
    ctaLink: '/products',
    showWhatsapp: true,
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
};

const homeSectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    eyebrow: { type: String, default: '' },
    title: { type: String, default: '' },
    hindi: { type: String, default: '' },
    subtitle: { type: String, default: '' },
  },
  { _id: false }
);

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
    shippingNote: { type: String, default: 'Free shipping in Delhi. Pan-India delivery available.' },

    // Socials
    instagram: { type: String, default: '' },
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

    // Fully admin-editable homepage layout (hero + ordered sections)
    homepage: {
      hero: {
        subheading: { type: String, default: DEFAULT_HOMEPAGE.hero.subheading },
        ctaLabel: { type: String, default: DEFAULT_HOMEPAGE.hero.ctaLabel },
        ctaLink: { type: String, default: DEFAULT_HOMEPAGE.hero.ctaLink },
        showWhatsapp: { type: Boolean, default: true },
      },
      sections: { type: [homeSectionSchema], default: () => DEFAULT_HOMEPAGE.sections },
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
