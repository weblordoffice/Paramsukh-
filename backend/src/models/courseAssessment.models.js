import mongoose from 'mongoose';

const assessmentOptionSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    trim: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const assessmentQuestionSchema = new mongoose.Schema({
  prompt: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['mcq', 'short_answer', 'descriptive'],
    default: 'mcq'
  },
  options: {
    type: [assessmentOptionSchema],
    default: []
  },
  correctOptionKey: {
    type: String,
    trim: true,
    default: null
  },
  acceptedAnswers: {
    type: [String],
    default: []
  },
  gradingMode: {
    type: String,
    enum: ['exact', 'contains', 'manual'],
    default: 'exact'
  },
  points: {
    type: Number,
    default: 1,
    min: 0
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  explanation: {
    type: String,
    trim: true,
    default: ''
  },
  order: {
    type: Number,
    default: 0
  }
}, { timestamps: false });

const courseAssessmentSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    trim: true,
    default: 'Course Assessment'
  },
  instructions: {
    type: String,
    trim: true,
    default: ''
  },
  questions: {
    type: [assessmentQuestionSchema],
    default: []
  },
  passingRule: {
    type: {
      type: String,
      enum: ['correct_count', 'percentage'],
      default: 'correct_count'
    },
    value: {
      type: Number,
      default: 5,
      min: 0
    }
  },
  maxAttempts: {
    type: Number,
    default: 3,
    min: 1
  },
  retakeCooldownHours: {
    type: Number,
    default: 0,
    min: 0
  },
  timeLimitMinutes: {
    type: Number,
    default: 0,
    min: 0
  },
  shuffleQuestions: {
    type: Boolean,
    default: false
  },
  isEnabled: {
    type: Boolean,
    default: false
  },
  vivaRequired: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
}, {
  timestamps: true
});

export const CourseAssessment = mongoose.model('CourseAssessment', courseAssessmentSchema);
export default CourseAssessment;
