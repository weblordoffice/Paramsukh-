import mongoose from 'mongoose';

const pointTransactionSchema = new mongoose.Schema({
  userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  referredUserId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  ruleId:            { type: mongoose.Schema.Types.ObjectId, ref: 'ReferralEarningRule', default: null },
  type:              { type: String, required: true, index: true },
  points:            { type: Number, required: true },
  balance:           { type: Number, default: 0 },
  pointValue:        { type: Number, default: 1 },
  rupeeValue:        { type: Number, default: 0 },
  status:            { type: String, enum: ['active', 'held', 'redeemed', 'expired', 'revoked'], default: 'active' },
  holdUntil:         { type: Date, default: null },
  expiresAt:         { type: Date, default: null },
  redeemedIn:        { type: String, default: null },
  metadata:          { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

pointTransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });
pointTransactionSchema.index({ status: 1, expiresAt: 1 });

export const PointTransaction = mongoose.model('PointTransaction', pointTransactionSchema);
export default PointTransaction;
