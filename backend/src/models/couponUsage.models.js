import mongoose from 'mongoose';

const couponUsageSchema = new mongoose.Schema({
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
    index: true
  },
  referenceType: {
    type: String,
    enum: ['order', 'membership', 'event', 'counseling'],
    default: 'order',
    index: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0
  },
  usedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

couponUsageSchema.index({ coupon: 1, user: 1 });
couponUsageSchema.index(
  { coupon: 1, referenceType: 1, referenceId: 1 },
  { unique: true, partialFilterExpression: { referenceId: { $type: 'objectId' } } }
);

const CouponUsage = mongoose.model('CouponUsage', couponUsageSchema);

export default CouponUsage;
