import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    hindiName: { type: String, default: '' },
    slug: { type: String, index: true },
    sku: { type: String, default: '' },

    // The signature "हर झुमका एक कहानी" story for each jhumka
    story: { type: String, default: '' },
    description: { type: String, default: '' },

    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, default: 0 }, // original / struck-through price

    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    collectionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Collection' }],

    images: { type: [String], default: [] },
    video: { type: String, default: '' },

    material: { type: String, default: '' },
    weight: { type: String, default: '' },
    tags: { type: [String], default: [] },

    stockQty: { type: Number, default: 0 },
    inStock: { type: Boolean, default: true },

    isNewArrival: { type: Boolean, default: false },
    isBestseller: { type: Boolean, default: false },
    isOnSale: { type: Boolean, default: false },

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', hindiName: 'text', story: 'text', tags: 'text' });

const Product = mongoose.model('Product', productSchema);
export default Product;
