import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  { line1: String, line2: String, city: String, state: String, pincode: String },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    passwordHash: { type: String, default: '' }, // empty for Google-only accounts
    googleId: { type: String, default: '' },
    avatar: { type: String, default: '' },
    address: { type: addressSchema, default: {} },
    // Server-side cart so the bag follows the customer across devices.
    cart: { type: [{ productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, qty: Number }], default: [] },
  },
  { timestamps: true }
);

// Safe public projection (never leak passwordHash).
customerSchema.methods.toPublic = function toPublic() {
  return { id: this._id, name: this.name, email: this.email, phone: this.phone, avatar: this.avatar, address: this.address || {}, cart: this.cart || [] };
};

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
