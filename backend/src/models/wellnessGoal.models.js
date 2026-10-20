import mongoose from 'mongoose';

const wellnessGoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: '',
  },
  category: {
    type: String,
    enum: ['physical', 'mental', 'emotional', 'spiritual', 'financial', 'relationship', 'lifestyle', 'other'],
    default: 'other',
    index: true,
  },
  targetValue: {
    type: Number,
    required: true,
    min: 0.01,
  },
  currentValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  unit: {
    type: String,
    trim: true,
    maxlength: 40,
    default: '',
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  targetDate: {
    type: Date,
    default: null,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused'],
    default: 'active',
    index: true,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  lastProgressAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

wellnessGoalSchema.index({ userId: 1, status: 1, createdAt: -1 });
wellnessGoalSchema.index({ userId: 1, targetDate: 1 });

wellnessGoalSchema.methods.refreshCompletionState = function () {
  const target = Number(this.targetValue) || 0;
  const current = Number(this.currentValue) || 0;

  if (target > 0 && current >= target) {
    this.status = 'completed';
    if (!this.completedAt) this.completedAt = new Date();
  } else if (this.status === 'completed') {
    this.status = 'active';
    this.completedAt = null;
  }
};

export const WellnessGoal = mongoose.model('WellnessGoal', wellnessGoalSchema);
export default WellnessGoal;
