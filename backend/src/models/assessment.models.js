import mongoose from 'mongoose';

const assessmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One assessment per user
  },
  // Personal Information
  age: {
    type: Number,
    required: true,
    min: 1,
    max: 120
  },
  occupation: {
    type: String,
    required: true,
    trim: true
  },
  countryCode: {
    type: String,
    trim: true
  },
  countryName: {
    type: String,
    trim: true
  },
  stateCode: {
    type: String,
    trim: true
  },
  stateName: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  // Assessment Questions
  physicalIssue: {
    type: Boolean,
    required: true
  },
  physicalIssueDetails: {
    type: String,
    trim: true
  },
  specialDiseaseIssue: {
    type: Boolean,
    required: true
  },
  specialDiseaseDetails: {
    type: String,
    trim: true
  },
  relationshipIssue: {
    type: Boolean,
    required: true
  },
  relationshipIssueDetails: {
    type: String,
    trim: true
  },
  financialIssue: {
    type: Boolean,
    required: true
  },
  financialIssueDetails: {
    type: String,
    trim: true
  },
  mentalHealthIssue: {
    type: Boolean,
    required: true
  },
  mentalHealthIssueDetails: {
    type: String,
    trim: true
  },
  spiritualGrowth: {
    type: Boolean,
    required: true
  },
  spiritualGrowthDetails: {
    type: String,
    trim: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update updatedAt on save
assessmentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Assessment = mongoose.model('Assessment', assessmentSchema);

export default Assessment;
