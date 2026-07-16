import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  referredUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['joined', 'completed'],
    default: 'joined'
  },
  rewardApplied: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export const Referral = mongoose.model('Referral', referralSchema);
export default Referral;
