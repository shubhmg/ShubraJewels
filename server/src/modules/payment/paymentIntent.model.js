import mongoose from 'mongoose';

// A server-priced snapshot of an order, created when a Razorpay order is opened.
// Both /verify (browser) and the webhook (backstop) finalize from this, so the
// order is created exactly once even if the browser dies after payment capture.
const paymentIntentSchema = new mongoose.Schema(
  {
    razorpayOrderId: { type: String, required: true, unique: true },
    items: [{ productId: mongoose.Schema.Types.ObjectId, name: String, image: String, price: Number, qty: Number }],
    customer: { name: String, phone: String, email: String },
    address: { line1: String, line2: String, city: String, state: String, pincode: String },
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
    // Auto-expire abandoned intents after 24h.
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
  },
  { timestamps: false }
);

const PaymentIntent = mongoose.model('PaymentIntent', paymentIntentSchema);
export default PaymentIntent;
