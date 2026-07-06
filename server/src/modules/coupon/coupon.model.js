import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['percent', 'flat'], default: 'percent' },
    value: { type: Number, required: true, min: 0 },
    minSubtotal: { type: Number, default: 0 },   // minimum order value to qualify
    maxDiscount: { type: Number, default: 0 },    // cap for percent coupons (0 = no cap)
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, default: 0 },     // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
