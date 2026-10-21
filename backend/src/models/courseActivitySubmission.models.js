import mongoose from 'mongoose';

const courseActivitySubmissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['quiz', 'reflection'],
    required: true,
    index: true,
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    default: null,
    index: true,
  },
  reflectionId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true,
  },
  answers: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  response: {
    type: String,
    default: null,
  },
  score: {
    type: Number,
    default: null,
  },
  maxScore: {
    type: Number,
    default: null,
  },
  percentage: {
    type: Number,
    default: null,
  },
  passed: {
    type: Boolean,
    default: null,
  },
  attemptNumber: {
    type: Number,
    default: 1,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

courseActivitySubmissionSchema.index({ userId: 1, courseId: 1, type: 1, submittedAt: -1 });
courseActivitySubmissionSchema.index({ userId: 1, assignmentId: 1, attemptNumber: -1 });
courseActivitySubmissionSchema.index({ userId: 1, courseId: 1, reflectionId: 1 }, { unique: true, partialFilterExpression: { type: 'reflection' } });

export const CourseActivitySubmission = mongoose.model('CourseActivitySubmission', courseActivitySubmissionSchema);
export default CourseActivitySubmission;
