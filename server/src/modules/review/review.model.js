import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, default: '' },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    text: { type: String, default: '' },
    image: { type: String, default: '' }, // optional customer photo
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    // Post-purchase authenticity: set when the review comes from a customer
    // who actually received this item in a delivered order.
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    verifiedPurchase: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Review = mongoose.model('Review', reviewSchema);
export default Review;
