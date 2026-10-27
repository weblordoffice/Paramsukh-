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
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CertificateTemplate',
    default: null
  },
  templateVersion: {
    type: Number,
    default: null
  },
  templateSnapshot: {
    type: mongoose.Schema.Types.Mixed,
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

const certificateFieldSchema = new mongoose.Schema({
  key: {
    type: String,
    enum: ['recipientName', 'courseName', 'certificateTitle', 'certificateId', 'issuedDate', 'planName', 'customText', 'qrCode'],
    required: true,
  },
  type: { type: String, enum: ['text', 'qr'], default: 'text' },
  label: { type: String, trim: true, default: '' },
  text: { type: String, trim: true, default: '' },
  xPercent: { type: Number, min: 0, max: 100, required: true },
  yPercent: { type: Number, min: 0, max: 100, required: true },
  widthPercent: { type: Number, min: 1, max: 100, default: 80 },
  fontSize: { type: Number, min: 4, max: 200, default: 24 },
  color: { type: String, default: '#2F241F' },
  align: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
  fontWeight: { type: String, enum: ['normal', 'bold'], default: 'normal' },
}, { _id: false });

const certificateTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  certificateType: {
    type: String,
    enum: ['membership', 'course_participation', 'course_assessment'],
    required: true,
    index: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null,
    index: true,
  },
  backgroundType: { type: String, enum: ['image', 'pdf'], required: true },
  backgroundUrl: { type: String, required: true },
  backgroundPublicId: { type: String, default: null },
  pageWidth: { type: Number, default: 842 },
  pageHeight: { type: Number, default: 595 },
  fields: { type: [certificateFieldSchema], default: [] },
  version: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

certificateTemplateSchema.index({ certificateType: 1, courseId: 1, isActive: 1 });

export const Certificate = mongoose.model('Certificate', certificateSchema);
export const CertificateTemplate = mongoose.model('CertificateTemplate', certificateTemplateSchema);
export default Certificate;
