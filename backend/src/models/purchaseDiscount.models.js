import mongoose from 'mongoose';

const purchaseDiscountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  purchaseType: {
    type: String,
    enum: ['membership', 'event', 'counseling'],
    required: true,
    index: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true,
  },
  baseAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  sourceType: {
    type: String,
    enum: ['offer', 'coupon', 'none'],
    default: 'none',
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    default: null,
  },
  offer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    default: null,
  },
  couponCode: {
    type: String,
    trim: true,
    default: null,
  },
  offerTitle: {
    type: String,
    trim: true,
    default: null,
  },
  providerOrderId: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  providerPaymentLinkId: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  referenceType: {
    type: String,
    enum: ['membership', 'event', 'counseling'],
    default: null,
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'applied', 'cancelled'],
    default: 'pending',
    index: true,
  },
  appliedAt: {
    type: Date,
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

purchaseDiscountSchema.index({ purchaseType: 1, status: 1, createdAt: -1 });
purchaseDiscountSchema.index({ referenceType: 1, referenceId: 1 });

export const PurchaseDiscount = mongoose.model('PurchaseDiscount', purchaseDiscountSchema);
export default PurchaseDiscount;
