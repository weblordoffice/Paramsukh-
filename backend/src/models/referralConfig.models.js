import mongoose from 'mongoose';

const referralConfigSchema = new mongoose.Schema({
  isActive:          { type: Boolean, default: true },
  pointValueInRupees: { type: Number, default: 1, min: 0 },
  referralCodeFormat: { type: String, enum: ['displayName', 'random8', 'random12'], default: 'displayName' },

  minRedemptionPoints:     { type: Number, default: 50 },
  maxRedemptionPercent:    { type: Number, default: 50, min: 0, max: 100 },
  pointsExpireMonths:      { type: Number, default: 12, min: 0 },
  maxPointsPerReferrerTotal: { type: Number, default: 50000, min: 0 },

  minReferrerAccountAgeDays: { type: Number, default: 7 },
  maxReferralsPerIP24h:      { type: Number, default: 5 },
  purchasePointsHoldDays:    { type: Number, default: 7 },

  notifyOnEarn:   { type: Boolean, default: true },
  notifyOnRedeem: { type: Boolean, default: true },

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

export const ReferralConfig = mongoose.model('ReferralConfig', referralConfigSchema);
export default ReferralConfig;
