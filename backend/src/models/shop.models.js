import mongoose from 'mongoose';

const shopSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  logo: {
    type: String // Logo URL
  },
  banner: {
    type: String // Banner image URL
  },
  // Business Details
  businessType: {
    type: String,
    enum: ['individual', 'proprietorship', 'partnership', 'company'],
    default: 'individual'
  },
  gstNumber: {
    type: String,
    trim: true
  },
  panNumber: {
    type: String,
    trim: true
  },
  // Contact Information
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  whatsapp: {
    type: String,
    trim: true
  },
  // Address
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  // Location coordinates
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  // Categories this shop deals in
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  // Shop timings
  timings: {
    monday: { open: String, close: String, isClosed: Boolean },
    tuesday: { open: String, close: String, isClosed: Boolean },
    wednesday: { open: String, close: String, isClosed: Boolean },
    thursday: { open: String, close: String, isClosed: Boolean },
    friday: { open: String, close: String, isClosed: Boolean },
    saturday: { open: String, close: String, isClosed: Boolean },
    sunday: { open: String, close: String, isClosed: Boolean }
  },
  // Ratings & Reviews
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  // Statistics
  stats: {
    totalProducts: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 }
  },
  // Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  },
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended', 'inactive'],
    default: 'pending'
  },
  rejectionReason: {
    type: String
  },
  // Featured
  isFeatured: {
    type: Boolean,
    default: false
  },
  // Social Media
  socialMedia: {
    facebook: String,
    instagram: String,
    twitter: String,
    website: String
  },
  // Policies
  policies: {
    returnPolicy: String,
    shippingPolicy: String,
    cancellationPolicy: String
  }
}, {
  timestamps: true
});

// Indexes
shopSchema.index({ status: 1 });
shopSchema.index({ 'rating.average': -1 });
shopSchema.index({ location: '2dsphere' });

// Update product count
shopSchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  const count = await Product.countDocuments({ shop: this._id, isActive: true });
  this.stats.totalProducts = count;
  await this.save();
};

const Shop = mongoose.model('Shop', shopSchema);

export default Shop;
