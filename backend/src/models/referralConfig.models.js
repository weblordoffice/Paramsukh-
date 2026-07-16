import mongoose from 'mongoose';

const referralConfigSchema = new mongoose.Schema({
  campaignName: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rewardType: {
    type: String,
    enum: ['premium_extension', 'unlock_course', 'badge_only'],
    default: 'premium_extension'
  },
  rewardValue: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  referrerRewardText: {
    type: String,
    required: true,
    default: "Get 15 days of Premium Gurukul Access!"
  },
  refereeRewardText: {
    type: String,
    required: true,
    default: "Start your scientific wellness journey!"
  }
}, {
  timestamps: true
});

export const ReferralConfig = mongoose.model('ReferralConfig', referralConfigSchema);
export default ReferralConfig;
