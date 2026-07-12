import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  { line1: String, line2: String, landmark: String, city: String, state: String, pincode: String },
  { _id: false }
);

// Address book entry — each has its own _id so the storefront can select/delete
// a specific saved address. Carries an optional contact so an address can be a
// gift/ship-to for someone else.
const savedAddressSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    line1: { type: String, default: '' },
    line2: { type: String, default: '' },
    landmark: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
  },
  { _id: true, timestamps: true }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    passwordHash: { type: String, default: '' }, // empty for Google-only accounts
    googleId: { type: String, default: '' },
    avatar: { type: String, default: '' },
    address: { type: addressSchema, default: {} }, // legacy single address (kept for back-compat)
    addresses: { type: [savedAddressSchema], default: [] }, // address book
    // Server-side cart so the bag follows the customer across devices.
    cart: { type: [{ productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, qty: Number }], default: [] },
  },
  { timestamps: true }
);

// Safe public projection (never leak passwordHash).
customerSchema.methods.toPublic = function toPublic() {
  return { id: this._id, name: this.name, email: this.email, phone: this.phone, avatar: this.avatar, address: this.address || {}, addresses: this.addresses || [], cart: this.cart || [] };
};

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
