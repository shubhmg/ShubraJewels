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
      email: { type: String, required: true },
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
    // Orders start CONFIRMED (payment/advance done at checkout, inventory
    // reserved). 'pending' is kept only for back-compat with old orders.
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'confirmed',
    },
    // Shipment tracking — a single free-text message the owner pastes when
    // marking the order Shipped (the delivery partner's note with tracking id +
    // link). Shown as-is to the customer.
    tracking: {
      message: { type: String, default: '' },
      shippedAt: { type: Date, default: null },
    },
    // Courier shipment. `provider: 'manual'` = the owner ships it themselves and
    // pastes a tracking note (legacy flow). `provider: 'delhivery'` = a Delhivery
    // waybill was booked via the API; `waybill` + `status` + `labelUrl` are set
    // from Delhivery and refreshed by the sync action.
    shipment: {
      provider: { type: String, enum: ['manual', 'delhivery', 'shiprocket'], default: 'manual' },
      waybill: { type: String, default: '' },           // AWB / tracking number
      shipmentId: { type: String, default: '' },        // Shiprocket shipment id (for label/pickup)
      srOrderId: { type: String, default: '' },         // Shiprocket internal order id (for cancel)
      courierName: { type: String, default: '' },       // assigned courier (Shiprocket)
      trackingUrl: { type: String, default: '' },       // public track URL (provider-specific)
      mode: { type: String, default: '' },          // 'COD' | 'Prepaid' (as sent to the courier)
      codAmount: { type: Number, default: 0 },        // amount to collect on delivery
      weightGrams: { type: Number, default: 0 },      // weight declared to the courier
      status: { type: String, default: '' },          // latest courier status
      statusDetail: { type: String, default: '' },    // location / status type
      labelUrl: { type: String, default: '' },         // packing-slip PDF link
      bookedAt: { type: Date, default: null },
      lastSyncedAt: { type: Date, default: null },
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
    // COD advance (partial prepayment via Razorpay to confirm a COD order).
    advancePaid: { type: Number, default: 0 },
    advanceRazorpayPaymentId: { type: String, default: '' },
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
