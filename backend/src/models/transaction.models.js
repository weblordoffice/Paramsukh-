import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  userName: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    enum: ['membership', 'order', 'event', 'counseling', 'podcast', 'donation', 'admin_grant'],
    required: true,
    index: true
  },
  sourceId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'refunded'],
    default: 'success'
  },
  provider: {
    type: String,
    default: 'razorpay'
  },
  providerRef: {
    type: String,
    default: ''
  },
  metadata: {
    planName: { type: String },
    courseName: { type: String },
    eventName: { type: String },
    productName: { type: String },
    paymentId: { type: String },
    orderId: { type: String }
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  refundedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

transactionSchema.index({ source: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, createdAt: -1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
