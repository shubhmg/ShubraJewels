import mongoose from 'mongoose';

// A server-priced snapshot of an order, created when a Razorpay order is opened.
// Both /verify (browser) and the webhook (backstop) finalize from this, so the
// order is created exactly once even if the browser dies after payment capture.
const paymentIntentSchema = new mongoose.Schema(
  {
    razorpayOrderId: { type: String, required: true, unique: true },
    // 'full' = pay-online-in-full; 'cod_advance' = partial prepay to confirm a COD order.
    kind: { type: String, enum: ['full', 'cod_advance'], default: 'full' },
    advance: { type: Number, default: 0 }, // amount charged now (cod_advance)
    codFee: { type: Number, default: 0 },
    items: [{ productId: mongoose.Schema.Types.ObjectId, name: String, image: String, price: Number, qty: Number }],
    customer: { name: String, phone: String, email: String },
    address: { line1: String, line2: String, landmark: String, city: String, state: String, pincode: String },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    subtotal: Number,
    shipping: Number,
    discount: Number,
    couponCode: { type: String, default: '' },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    total: Number,
    notes: { type: String, default: '' },
    status: { type: String, enum: ['created', 'completed'], default: 'created' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    // Stock is reserved when the intent is opened (before payment) so we never
    // charge for an unavailable item. The hold is transferred to the order on
    // finalize, or released if the intent expires / payment is abandoned.
    stockApplied: { type: Boolean, default: false },
    holdExpiresAt: { type: Date, default: null },
    // Auto-expire abandoned intents after 24h.
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
  },
  { timestamps: false }
);

const PaymentIntent = mongoose.model('PaymentIntent', paymentIntentSchema);
export default PaymentIntent;
