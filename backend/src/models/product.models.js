import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
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
    required: true
  },
  shortDescription: {
    type: String,
    trim: true
  },
  // Images
  images: [{
    url: { type: String, required: true },
    alt: { type: String },
    isPrimary: { type: Boolean, default: false }
  }],
  // Category
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  // Pricing
  pricing: {
    mrp: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    taxRate: { type: Number, default: 0, min: 0 } // GST %
  },
  // Inventory
  inventory: {
    stock: { type: Number, required: true, default: 0, min: 0 },
    sku: { type: String, unique: true, sparse: true },
    lowStockThreshold: { type: Number, default: 10 },
    isUnlimited: { type: Boolean, default: false }
  },
  // Product Specifications
  specifications: [{
    key: { type: String, required: true },
    value: { type: String, required: true }
  }],
  // Variants (size, color, etc.)
  variants: [{
    name: { type: String }, // e.g., "Size", "Color"
    option: { type: String }, // e.g., "Large", "Red"
    price: { type: Number },
    stock: { type: Number },
    sku: { type: String }
  }],
  // Shipping
  shipping: {
    weight: { type: Number }, // in kg
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    isFreeShipping: { type: Boolean, default: false },
    shippingCharge: { type: Number, default: 0 }
  },
  // Ratings & Reviews
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  // Tags
  tags: [{
    type: String,
    trim: true
  }],
  // Product type: regular (sell here) or external (external link)
  productType: {
    type: String,
    enum: ['regular', 'external'],
    default: 'regular'
  },
  // When productType is 'external', link to product page (e.g. Amazon URL). Click opens this link.
  externalLink: {
    type: String,
    default: null,
    trim: true
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isOutOfStock: {
    type: Boolean,
    default: false
  },
  // SEO
  metaTitle: {
    type: String
  },
  metaDescription: {
    type: String
  },
  // Statistics
  stats: {
    views: { type: Number, default: 0 },
    wishlistCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes
productSchema.index({ slug: 1 });
productSchema.index({ shop: 1, isActive: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ 'pricing.sellingPrice': 1 });
productSchema.index({ 'rating.average': -1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Calculate discount percentage
productSchema.pre('save', function(next) {
  if (this.pricing.mrp && this.pricing.sellingPrice) {
    this.pricing.discount = Math.round(((this.pricing.mrp - this.pricing.sellingPrice) / this.pricing.mrp) * 100);
  }
  
  // Check stock status
  if (!this.inventory.isUnlimited && this.inventory.stock === 0) {
    this.isOutOfStock = true;
  } else {
    this.isOutOfStock = false;
  }
  
  next();
});

// Method to check if product is available
productSchema.methods.isAvailable = function(quantity = 1) {
  if (this.inventory.isUnlimited) return true;
  return this.inventory.stock >= quantity;
};

const Product = mongoose.model('Product', productSchema);

export default Product;
