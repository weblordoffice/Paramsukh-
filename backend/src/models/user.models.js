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
    sparse: true,
    lowercase: true,
    trim: true
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
    enum: ['phone'],
    required: true,
    default: 'phone'
  },



  // Subscription
  subscriptionPlan: {
    type: String,
    trim: true,
    lowercase: true,
    default: 'free'
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
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    date: {
      type: Date,
      default: Date.now
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

  // Gamification
  gamification: {
    totalPoints: {
      type: Number,
      default: 0
    },
    currentLevel: {
      type: String,
      default: 'Beginner'
    },
    badges: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reward'
    }]
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



