import mongoose from 'mongoose';

// Offer banners: e.g. "Korean earrings free", "Free shipping in Delhi".
const bannerSchema = new mongoose.Schema(
  {
    placement: { type: String, enum: ['topStrip', 'hero', 'offer'], default: 'offer' },
    text: { type: String, default: '' },
    hindiText: { type: String, default: '' },
    subtext: { type: String, default: '' },
    image: { type: String, default: '' },
    bgColor: { type: String, default: '' },
    ctaLabel: { type: String, default: '' },
    ctaLink: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Banner = mongoose.model('Banner', bannerSchema);
export default Banner;
