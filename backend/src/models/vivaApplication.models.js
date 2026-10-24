import mongoose from 'mongoose';

const vivaStatusHistorySchema = new mongoose.Schema({
  from: {
    type: String,
    default: null

  },
  to: {
    type: String,
    required: true
  },
  actorType: {
    type: String,
    enum: ['user', 'admin', 'system'],
    default: 'system'
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  note: {
    type: String,
    default: ''
  },
  at: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const vivaApplicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true
  },
  assessmentAttempt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssessmentAttempt',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: [
      'applied',
      'under_review',
      'scheduled',
      'completed',
      'passed',
      'failed',
      'cancelled'
    ],
    default: 'applied',
    index: true
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  scheduledAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  meetingPlatform: {
    type: String,
    default: ''
  },
  meetingLink: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  examiner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  result: {
    status: {
      type: String,
      enum: ['passed', 'failed', null],
      default: null
    },
    remarks: {
      type: String,
      default: ''
    },
    feedback: {
      type: String,
      default: ''
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    recordedAt: {
      type: Date,
      default: null
    }
  },
  certificate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificate',
    default: null
  },
  statusHistory: {
    type: [vivaStatusHistorySchema],
    default: []
  }
}, {
  timestamps: true
});

vivaApplicationSchema.index(
  { user: 1, course: 1, assessmentAttempt: 1 },
  { unique: true }
);
vivaApplicationSchema.index({ status: 1, appliedAt: -1 });

export const VivaApplication = mongoose.model('VivaApplication', vivaApplicationSchema);
export default VivaApplication;
