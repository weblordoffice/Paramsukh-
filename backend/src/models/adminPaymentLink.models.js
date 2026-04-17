import mongoose from 'mongoose';

const adminPaymentLinkSchema = new mongoose.Schema(
  {
    paymentLinkId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    shortUrl: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planSlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    validityDays: {
      type: Number,
      required: true,
      min: 1,
      default: 365,
    },
    status: {
      type: String,
      enum: ['created', 'paid', 'expired', 'cancelled', 'failed'],
      default: 'created',
      index: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
      index: true,
    },
    adminIdentifier: {
      type: String,
      default: null,
      trim: true,
    },
    paymentId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

adminPaymentLinkSchema.index({ userId: 1, createdAt: -1 });
adminPaymentLinkSchema.index({ status: 1, createdAt: -1 });

export const AdminPaymentLink = mongoose.model('AdminPaymentLink', adminPaymentLinkSchema);
