import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    hindiName: { type: String, trim: true, default: '' },
    slug: { type: String, trim: true, index: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Category = mongoose.model('Category', categorySchema);
export default Category;
