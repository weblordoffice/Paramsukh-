import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  // Authentication fields
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true
  },

  // Profile
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
  },
  photoURL: {
    type: String,
    default: null
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  // Authentication type
  authProvider: {
    type: String,
    enum: ['phone', 'google', 'clerk'],
    required: true,
    default: 'phone'
  },
  clerkId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true
  },



  // Subscription
  subscriptionPlan: {
    type: String,
    trim: true,
    lowercase: true,
    default: 'free'
  },
  subscriptionPlanVariant: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'trial', 'cancelled'],
    default: 'inactive'
  },
  subscriptionStartDate: {
    type: Date,
    default: null
  },
  subscriptionEndDate: {
    type: Date,
    default: null
  },
  trialEndsAt: {
    type: Date,
    default: null
  },

  // Payment history
  payments: [{
    orderId: {
      type: String,
      required: true
    },
    paymentId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    plan: {
      type: String,
      required: true
    },
    planVariant: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    date: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],

  // User preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    notifications: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: false
    },
    autoPlay: {
      type: Boolean,
      default: true
    },
    dataSaver: {
      type: Boolean,
      default: false
    }
  },

  // Assessment tracking
  assessmentCompleted: {
    type: Boolean,
    default: false
  },
  assessmentCompletedAt: {
    type: Date,
    default: null
  },

  // Account status
  isActive: {
    type: Boolean,
    default: true
  },

  // Analytics
  lastLoginAt: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 0
  },
  unlockedBadges: [{
    badgeId: {
      type: String,
      required: true
    },
    unlockedAt: {
      type: Date,
      default: Date.now
    }
  }],
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ phone: 1 });
userSchema.index({ email: 1 });
userSchema.index({ tags: 1 });

// Methods
userSchema.methods.updateLastLogin = function () {
  this.lastLoginAt = new Date();
  this.loginCount += 1;
  return this.save();
};

userSchema.methods.hasProAccess = function () {
  return this.subscriptionPlan !== 'free'
    && this.subscriptionStatus === 'active';
};

export const User = mongoose.model("User", userSchema);



