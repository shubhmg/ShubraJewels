import mongoose from 'mongoose';

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
