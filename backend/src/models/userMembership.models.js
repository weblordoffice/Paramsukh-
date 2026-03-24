import mongoose from 'mongoose';

const membershipPaymentSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['razorpay', 'manual', 'other'],
    default: 'razorpay',
  },
  orderId: {
    type: String,
    default: null,
    trim: true,
  },
  paymentId: {
    type: String,
    default: null,
    trim: true,
  },
  amount: {
    type: Number,
    default: 0,
    min: 0,
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    trim: true,
  },
}, { _id: false });

const userMembershipSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPlan',
    required: true,
    index: true,
  },
  planSnapshot: {
    title: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true },
    pricing: {
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'INR' },
      type: { type: String, enum: ['one_time', 'monthly', 'yearly'], default: 'one_time' },
    },
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'paused', 'pending'],
    default: 'active',
    index: true,
  },
  source: {
    type: String,
    enum: ['purchase', 'admin_grant', 'upgrade', 'renewal', 'migration'],
    default: 'purchase',
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
    index: true,
  },
  autoRenew: {
    type: Boolean,
    default: false,
  },
  payment: {
    type: membershipPaymentSchema,
    default: () => ({ provider: 'manual', amount: 0, currency: 'INR' }),
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

userMembershipSchema.index({ userId: 1, status: 1, endDate: -1 });

export const UserMembership = mongoose.model('UserMembership', userMembershipSchema);
