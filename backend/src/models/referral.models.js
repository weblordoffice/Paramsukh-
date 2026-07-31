import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  referrer:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  referredUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  referralCode: { type: String, required: true },
  metadata: {
    ip:         { type: String },
    userAgent:  { type: String },
    channel:    { type: String, enum: ['app', 'web', 'link', 'unknown'], default: 'unknown' },
  },
}, { timestamps: true });

export const Referral = mongoose.model('Referral', referralSchema);
export default Referral;
