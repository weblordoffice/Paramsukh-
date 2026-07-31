import mongoose from 'mongoose';

const earningRuleSchema = new mongoose.Schema({
  name:               { type: String, required: true },
  slug:               { type: String, required: true, unique: true },
  description:        { type: String, default: '' },
  triggerEvent:       { type: String, required: true, enum: [
    'user.signup', 'user.first_purchase', 'user.course_complete',
    'user.monthly_active', 'user.membership_renew', 'user.event_register',
    'user.counseling_book', 'user.anniversary'
  ]},
  pointsValue:        { type: Number, required: true, min: 0 },
  isActive:           { type: Boolean, default: true },
  cooldownPerUser:    { type: Number, default: 1 },
  minReferrerAccountAgeHours: { type: Number, default: 0 },
  holdDays:           { type: Number, default: 0 },
  displayOrder:       { type: Number, default: 0 },
}, { timestamps: true });

export const ReferralEarningRule = mongoose.model('ReferralEarningRule', earningRuleSchema);
export default ReferralEarningRule;
