import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
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
  bannerImage: {
    type: String,
    trim: true,
    default: null,
  },
  discountType: {
    type: String,
    enum: ['percentage', 'flat'],
    required: true,
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  maxDiscount: {
    type: Number,
    default: null,
    min: 0,
  },
  minOrderValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  applicableOn: {
    type: String,
    enum: ['all', 'category', 'product', 'shop'],
    default: 'all',
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  }],
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
  shops: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
  }],
  startDate: {
    type: Date,
    required: true,
    index: true,
  },
  endDate: {
    type: Date,
    required: true,
    index: true,
  },
  priority: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  stats: {
    timesApplied: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
  },
}, {
  timestamps: true,
});

offerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
offerSchema.index({ applicableOn: 1 });

offerSchema.methods.isCurrentlyActive = function () {
  const now = new Date();
  return this.isActive === true && this.startDate <= now && this.endDate >= now;
};

export const Offer = mongoose.model('Offer', offerSchema);
export default Offer;
