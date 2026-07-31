import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true
  },
  icon: {
    type: String, // Emoji or icon name
    default: '📦'
  },
  image: {
    type: String // Category image URL
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  // Category ordering
  order: {
    type: Number,
    default: 0
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  // SEO
  metaTitle: {
    type: String
  },
  metaDescription: {
    type: String
  },
  // Statistics
  productCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ isActive: 1, order: 1 });

const Category = mongoose.model('Category', categorySchema);

export default Category;
