import mongoose from 'mongoose';

const certificateAuditSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['issued', 'revoked', 'reissued'],
    required: true
  },
  actorType: {
    type: String,
    enum: ['system', 'admin', 'user'],
    default: 'system'
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  reason: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  at: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const certificateSchema = new mongoose.Schema({
  certificateId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['membership', 'course_participation', 'course_assessment'],
    default: undefined,
    index: true
  },
  issuanceSource: {
    type: String,
    enum: ['automatic', 'manual'],
    default: undefined
  },
  status: {
    type: String,
    enum: ['issued', 'revoked'],
    default: 'issued',
    index: true
  },
  title: {
    type: String,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null,
    index: true
  },
  membership: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserMembership',
    default: null,
    index: true
  },
  assessmentAttempt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssessmentAttempt',
    default: null
  },
  vivaApplication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VivaApplication',
    default: null
  },
  issuedTo: {
    type: String,
    required: true
  },
  courseName: {
    type: String,
    trim: true
  },
  planName: {
    type: String,
    trim: true
  },
  validFrom: {
    type: Date,
    default: null
  },
  validTo: {
    type: Date,
    default: null
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  issuedByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  issuanceKey: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    index: true
  },
  legacy: {
    type: Boolean,
    default: false
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  revocationReason: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  auditTrail: {
    type: [certificateAuditSchema],
    default: []
  }
}, {
  timestamps: true
});

certificateSchema.index({ user: 1, course: 1, type: 1 });
certificateSchema.index({ user: 1, membership: 1, type: 1 });

export const Certificate = mongoose.model('Certificate', certificateSchema);
export default Certificate;
