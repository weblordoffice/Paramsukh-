import mongoose from 'mongoose';
import './couponUsage.models.js';

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  // Discount details
  discountType: {
    type: String,
    enum: ['percentage', 'flat'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  maxDiscount: {
    type: Number, // Max discount for percentage type
    default: null
  },
  // Conditions
  minOrderValue: {
    type: Number,
    default: 0
  },
  // Applicable to
  applicableOn: {
    type: String,
    enum: ['all', 'category', 'product', 'shop'],
    default: 'all'
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  shops: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop'
  }],
  // Usage limits
  maxUsageCount: {
    type: Number, // Total usage limit
    default: null
  },
  maxUsagePerUser: {
    type: Number, // Per user limit
    default: 1
  },
  currentUsageCount: {
    type: Number,
    default: 0
  },
  // User restrictions
  applicableUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }], // If empty, applicable to all
  userRestriction: {
    type: String,
    enum: ['all', 'specific', 'new', 'premium'],
    default: 'all'
  },
  // Validity
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  // Statistics
  stats: {
    totalUsed: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes
couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ startDate: 1, endDate: 1 });

// Check if coupon is valid
couponSchema.methods.isValid = function() {
  const now = new Date();
  
  // Check active status
  if (!this.isActive) return { valid: false, message: 'Coupon is inactive' };
  
  // Check date validity
  if (now < this.startDate) return { valid: false, message: 'Coupon not yet active' };
  if (now > this.endDate) return { valid: false, message: 'Coupon has expired' };
  
  // Check usage limit
  if (this.maxUsageCount && this.currentUsageCount >= this.maxUsageCount) {
    return { valid: false, message: 'Coupon usage limit reached' };
  }
  
  return { valid: true };
};

// Check if user can use coupon
couponSchema.methods.canUserUse = async function(userId, orderValue) {
  // Check if coupon is valid
  const validity = this.isValid();
  if (!validity.valid) return validity;
  
  // Check minimum order value
  if (orderValue < this.minOrderValue) {
    return { 
      valid: false, 
      message: `Minimum order value of ₹${this.minOrderValue} required` 
    };
  }
  
  // Check user-specific restrictions
  if (this.userRestriction === 'specific') {
    const isAllowed = this.applicableUsers.some(user => user.toString() === userId.toString());
    if (!isAllowed) {
      return { valid: false, message: 'Coupon not applicable for your account' };
    }
  }
  
  // Check per-user usage limit
  const CouponUsage = mongoose.model('CouponUsage');
  const userUsageCount = await CouponUsage.countDocuments({
    coupon: this._id,
    user: userId
  });
  
  if (userUsageCount >= this.maxUsagePerUser) {
    return { valid: false, message: 'You have already used this coupon' };
  }
  
  return { valid: true };
};

// Calculate discount amount
couponSchema.methods.calculateDiscount = function(orderValue) {
  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = (orderValue * this.discountValue) / 100;
    if (this.maxDiscount && discount > this.maxDiscount) {
      discount = this.maxDiscount;
    }
  } else {
    discount = this.discountValue;
  }
  
  return Math.min(discount, orderValue); // Discount cannot exceed order value
};

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
