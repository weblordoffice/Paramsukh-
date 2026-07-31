import mongoose from 'mongoose';

const moneySchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    trim: true,
  },
}, { _id: false });

const pricingSchema = new mongoose.Schema({
  oneTime: {
    type: moneySchema,
    required: true,
  },
  recurring: {
    monthly: {
      type: moneySchema,
      default: null,
    },
    yearly: {
      type: moneySchema,
      default: null,
    },
  },
}, { _id: false });

const limitsSchema = new mongoose.Schema({
  maxCategories: {
    type: Number,
    default: null,
    min: 1,
  },
  maxCoursesTotal: {
    type: Number,
    default: null,
    min: 1,
  },
  perCategoryCourseLimit: {
    type: Number,
    default: null,
    min: 1,
  },
}, { _id: false });

const accessSchema = new mongoose.Schema({
  includedCategories: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  includedSubcategories: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  includedCourseIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
  }],
  inheritedPlanIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPlan',
  }],
  limits: {
    type: limitsSchema,
    default: () => ({ maxCategories: null, maxCoursesTotal: null }),
  },
  accessMode: {
    type: String,
    enum: ['entitlement_only'],
    default: 'entitlement_only',
  },
  communityAccess: {
    type: Boolean,
    default: false,
  },
  counselingAccess: {
    type: Boolean,
    default: false,
  },
  eventAccess: {
    type: Boolean,
    default: false,
  },
  courseSelection: {
    enabled: {
      type: Boolean,
      default: false,
    },
    maxSelectableCourses: {
      type: Number,
      default: 3,
      min: 1,
    },
    eligibleCoursesMode: {
      type: String,
      enum: ['all_published', 'specific', 'categories'],
      default: 'all_published',
    },
    eligibleCourseIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    }],
    eligibleCategories: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
  },
}, { _id: false });

const benefitSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  included: {
    type: Boolean,
    default: true,
  },
}, { _id: false });

const membershipPlanSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  shortDescription: {
    type: String,
    default: '',
    trim: true,
  },
  longDescription: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  },
  displayOrder: {
    type: Number,
    default: 0,
    index: true,
  },
  pricing: {
    type: pricingSchema,
    required: true,
  },
  validityDays: {
    type: Number,
    default: 365,
    min: 1,
  },
  isLifetime: {
    type: Boolean,
    default: false,
  },
  access: {
    type: accessSchema,
    default: () => ({}),
  },
  benefits: {
    type: [benefitSchema],
    default: [],
  },

}, {
  timestamps: true,
});

membershipPlanSchema.index({ status: 1, displayOrder: 1, createdAt: -1 });

export const MembershipPlan = mongoose.model('MembershipPlan', membershipPlanSchema);
