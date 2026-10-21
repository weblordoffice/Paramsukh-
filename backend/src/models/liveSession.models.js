import mongoose from 'mongoose';

const LiveCoachingSessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 5000,
    default: '',
  },
  scheduledAt: {
    type: Date,
    required: true,
    index: true,
  },
  durationInMinutes: {
    type: Number,
    required: true,
    min: 1,
    default: 60,
  },
  meetingPlatform: {
    type: String,
    enum: ['zoom', 'google-meet', 'teams', 'other'],
    default: 'zoom',
  },
  meetingLink: {
    type: String,
    required: true,
    trim: true,
  },
  meetingPassword: {
    type: String,
    trim: true,
    default: null,
  },
  zoomMeetingId: {
    type: String,
    trim: true,
    default: null,
  },
  capacity: {
    type: Number,
    default: null,
    min: 1,
  },
  registrationCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  audienceType: {
    type: String,
    enum: ['all', 'plans'],
    default: 'all',
    index: true,
  },
  planSlugs: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  recordingUrl: {
    type: String,
    trim: true,
    default: null,
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled',
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
  },
}, {
  timestamps: true,
});

LiveCoachingSessionSchema.index({ scheduledAt: 1, status: 1 });
LiveCoachingSessionSchema.index({ audienceType: 1, planSlugs: 1 });

export const LiveCoachingSession = mongoose.model('LiveCoachingSession', LiveCoachingSessionSchema);
export default LiveCoachingSession;
