import mongoose from 'mongoose';

const liveSessionRegistrationSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveCoachingSession',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['registered', 'cancelled'],
    default: 'registered',
    index: true,
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  reminder24SentAt: {
    type: Date,
    default: null,
  },
  reminder1SentAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

liveSessionRegistrationSchema.index({ sessionId: 1, userId: 1 }, { unique: true });
liveSessionRegistrationSchema.index({ userId: 1, status: 1, registeredAt: -1 });

export const LiveSessionRegistration = mongoose.model('LiveSessionRegistration', liveSessionRegistrationSchema);
export default LiveSessionRegistration;
