import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productImage: {
    type: String
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  variant: {
    name: String,
    option: String
  },
  price: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  subtotal: {
    type: Number,
    required: true
  }
});

// Strip null/empty variants to avoid cast errors
orderItemSchema.pre('validate', function (next) {
  if (this.variant == null) {
    this.variant = undefined;
  } else if (typeof this.variant === 'object' && Object.keys(this.variant).length === 0) {
    this.variant = undefined;
  }
  next();
});

const orderSchema = new mongoose.Schema({
  // Order number
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // User
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Order items
  items: [orderItemSchema],
  // Delivery address
  deliveryAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: String,
    landmark: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  // Pricing
  pricing: {
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    shippingCharge: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true }
  },
  // Coupon applied
  coupon: {
    code: String,
    discount: Number,
    discountType: String
  },
  // Payment
  payment: {
    method: {
      type: String,
      enum: ['upi', 'card', 'netbanking', 'wallet', 'cod', 'razorpay', 'online'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paidAt: Date,
    refundedAt: Date,
    refundAmount: Number,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpayReceiptId: String
  },
  // Order status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
    default: 'pending',
    index: true
  },
  // Status tracking
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    comment: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Tracking
  tracking: {
    carrier: String,
    trackingNumber: String,
    trackingUrl: String,
    estimatedDelivery: Date
  },
  // Timestamps
  confirmedAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  returnedAt: Date,
  // Cancellation/Return
  cancellation: {
    reason: String,
    comment: String,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  returnRequest: {
    reason: String,
    comment: String,
    images: [String],
    requestedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed']
    },
    approvedAt: Date,
    completedAt: Date
  },
  // Notes
  customerNotes: String,
  adminNotes: String,
  // Invoice
  invoiceNumber: String,
  invoiceUrl: String
}, {
  timestamps: true
});

// Indexes
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.status': 1 });

// Generate order number
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(100000 + Math.random() * 900000);
    this.orderNumber = `ORD${year}${month}${random}`;
  }
  next();
});

// Add status to history
orderSchema.methods.updateStatus = async function (newStatus, comment = '', updatedBy = null) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    comment,
    updatedBy,
    timestamp: new Date()
  });

  // Update timestamps
  if (newStatus === 'confirmed') this.confirmedAt = new Date();
  if (newStatus === 'shipped') this.shippedAt = new Date();
  if (newStatus === 'delivered') this.deliveredAt = new Date();
  if (newStatus === 'cancelled') this.cancelledAt = new Date();
  if (newStatus === 'returned') this.returnedAt = new Date();

  await this.save();
  return this;
};

const Order = mongoose.model('Order', orderSchema);

export default Order;
