import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    items: { type: [orderItemSchema], default: [] },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: '' },
    },
    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      landmark: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    subtotal: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    codFee: { type: Number, default: 0 }, // extra fee charged on COD orders
    discount: { type: Number, default: 0 },
    couponCode: { type: String, default: '' },
    total: { type: Number, default: 0 },
    channel: { type: String, enum: ['web', 'whatsapp'], default: 'web' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    // true once this order's items have been deducted from stock (on delivery).
    stockApplied: { type: Boolean, default: false },
    // Payment
    paymentMethod: { type: String, enum: ['none', 'razorpay', 'cod', 'whatsapp', 'cash', 'upi', 'bank'], default: 'none' },
    // 'submitted' = customer paid via UPI and submitted a reference; awaiting
    // admin verification against the bank statement.
    paymentStatus: { type: String, enum: ['unpaid', 'submitted', 'paid'], default: 'unpaid' },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    // Direct-UPI manual flow
    upiRef: { type: String, default: '' },          // UTR / UPI reference no. from the customer
    paymentSubmittedAt: { type: Date, default: null },
    paymentVerifiedAt: { type: Date, default: null },
    // Auto-cleanup: abandoned direct-UPI orders (created, never paid/submitted)
    // carry a future expiry; the TTL index below deletes them once it passes.
    // Cleared (set null) the moment the order is paid, submitted, or edited by
    // admin — so only truly abandoned unpaid UPI orders ever expire.
    expiresAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// One order per Razorpay payment — blocks duplicate/replayed /verify calls.
// Sparse: COD/WhatsApp orders (empty paymentId) are exempt from uniqueness.
orderSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string', $gt: '' } } }
);

// TTL: delete a document once `expiresAt` is in the past. Docs with a null
// `expiresAt` (the vast majority) are ignored by the TTL monitor.
orderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
