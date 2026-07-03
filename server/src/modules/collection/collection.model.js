import mongoose from 'mongoose';

// Royal signature collections: Maharani, Rajputana, Banjara, Meenakari, Chandni, Noor.
const collectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    hindiName: { type: String, trim: true, default: '' },
    slug: { type: String, trim: true, index: true },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    accentColor: { type: String, default: '#C9A84C' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Collection = mongoose.model('Collection', collectionSchema);
export default Collection;
