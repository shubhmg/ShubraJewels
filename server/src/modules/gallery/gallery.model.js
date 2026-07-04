import mongoose from 'mongoose';

// Customer gallery — real customers wearing the jhumkas.
const galleryItemSchema = new mongoose.Schema(
  {
    image: { type: String, required: true },
    caption: { type: String, default: '' },
    customerName: { type: String, default: '' },
    link: { type: String, default: '' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const GalleryItem = mongoose.model('GalleryItem', galleryItemSchema);
export default GalleryItem;
