import mongoose from 'mongoose';

const assessmentAnswerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  questionType: {
    type: String,
    enum: ['mcq', 'short_answer', 'descriptive'],
    required: true
  },
  answer: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  awardedPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  isCorrect: {
    type: Boolean,
    default: null
  },
  gradingStatus: {
    type: String,
    enum: ['auto_graded', 'manual_pending', 'manual_graded'],
    default: 'auto_graded'
  },
  feedback: {
    type: String,
    default: ''
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  gradedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const assessmentAttemptSchema = new mongoose.Schema({
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
  assessment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseAssessment',
    required: true,
    index: true
  },
  attemptNumber: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['in_progress', 'pending_manual', 'graded', 'expired'],
    default: 'in_progress',
    index: true
  },
  answers: {
    type: [assessmentAnswerSchema],
    default: []
  },
  correctCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalQuestions: {
    type: Number,
    default: 0,
    min: 0
  },
  score: {
    type: Number,
    default: 0,
    min: 0
  },
  maxScore: {
    type: Number,
    default: 0,
    min: 0
  },
  percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  passed: {
    type: Boolean,
    default: null
  },
  startedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    default: null
  },
  submittedAt: {
    type: Date,
    default: null,
    index: true
  },
  gradedAt: {
    type: Date,
    default: null
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
}, {
  timestamps: true
});

assessmentAttemptSchema.index(
  { user: 1, assessment: 1, attemptNumber: 1 },
  { unique: true }
);
assessmentAttemptSchema.index({ user: 1, course: 1, submittedAt: -1 });
assessmentAttemptSchema.index({ course: 1, status: 1, submittedAt: -1 });

export const AssessmentAttempt = mongoose.model('AssessmentAttempt', assessmentAttemptSchema);
export default AssessmentAttempt;
