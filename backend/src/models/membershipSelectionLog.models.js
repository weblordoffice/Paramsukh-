import mongoose from 'mongoose';

const membershipSelectionLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  membershipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserMembership',
    required: true,
    index: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  action: {
    type: String,
    enum: ['select', 'undo', 'admin_override'],
    required: true,
  },
  creditsBefore: {
    type: Number,
    required: true,
  },
  creditsAfter: {
    type: Number,
    required: true,
  },
  ip: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

membershipSelectionLogSchema.index({ userId: 1, createdAt: -1 });
membershipSelectionLogSchema.index({ membershipId: 1, courseId: 1 });

export const MembershipSelectionLog = mongoose.model('MembershipSelectionLog', membershipSelectionLogSchema);
