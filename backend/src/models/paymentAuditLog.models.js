import mongoose from 'mongoose';

const paymentAuditLogSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    index: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'order_created',
      'payment_initiated',
      'payment_received',
      'payment_verified',
      'payment_failed',
      'fulfillment_started',
      'fulfillment_complete',
      'refund_initiated',
      'refund_completed',
      'refund_failed',
      'webhook_received',
      'webhook_processed',
      'idempotency_rejected',
    ],
  },
  provider: {
    type: String,
    enum: ['razorpay', 'cod', 'wallet', null],
    default: null,
  },
  providerRef: {
    type: String,
  },
  amount: {
    type: Number,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'rejected'],
    default: 'pending',
  },
  errorMessage: {
    type: String,
  },
  ip: {
    type: String,
  },
  userAgent: {
    type: String,
  },
}, {
  timestamps: true,
});

paymentAuditLogSchema.index({ createdAt: -1 });
paymentAuditLogSchema.index({ userId: 1, action: 1 });
paymentAuditLogSchema.index({ orderId: 1, action: 1 });

const PaymentAuditLog = mongoose.model('PaymentAuditLog', paymentAuditLogSchema);

export default PaymentAuditLog;
