import mongoose from "mongoose";

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  duration: {
    type: String, // e.g., "15:30", "20:00"
    required: true
  },
  durationInSeconds: {
    type: Number, // For easier sorting/filtering
    default: 0
  },
  videoUrl: {
    type: String, // URL to video content
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  order: {
    type: Number,
    required: true
  },
  isFree: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export const Video = mongoose.model("Video", videoSchema);

const pdfSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  pdfUrl: {
    type: String, // URL to PDF content
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  order: {
    type: Number,
    required: true
  },
  isFree: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export const Pdf = mongoose.model("Pdf", pdfSchema);

const liveSessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  durationInMinutes: {
    type: Number,
    required: true
  },
  meetingPlatform: {
    type: String,
    enum: ['zoom', 'google-meet', 'teams', 'other'],
    required: true
  },
  meetingLink: {
    type: String,
    required: true
  },
  recordingUrl: {
    type: String, // optional, added after session ends
    default: null
  },
  resources: [{
    title: String,
    pdfUrl: String
  }],
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  }
}, {
  timestamps: true
});

export const LiveSession = mongoose.model("LiveSession", liveSessionSchema);

const courseSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  shortDescription: {
    type: String,
    trim: true
  },

  // Visual/UI Properties
  icon: {
    type: String, // Icon name for display (e.g., 'fitness', 'bulb')
    default: 'book'
  },
  color: {
    type: String, // Hex color code for UI
    default: '#8B5CF6'
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  bannerUrl: {
    type: String,
    default: null
  },

  // Course Structure
  duration: {
    type: String, // e.g., "6 weeks", "8 weeks"
    required: true
  },
  videos: [videoSchema],
  totalVideos: {
    type: Number,
    default: 0
  },
  pdfs: [pdfSchema],
  totalPdfs: {
    type: Number,
    default: 0
  },
  liveSessions: [liveSessionSchema],

  // Course Metadata
  category: {
    type: String,
    enum: ['physical', 'mental', 'financial', 'relationship', 'spiritual', 'general'],
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],

  // Access Control
  includedInPlans: [{
    type: String,
    enum: ['bronze', 'copper', 'silver', 'gold2', 'gold1', 'diamond', 'patron', 'elite', 'quantum'],
    default: []
  }],

  // Pricing & Access
  // Note: Course access is controlled by subscription plan limits, not individual course requirements
  // Users can select any courses up to their plan's limit (copper: 1, silver: 3, gold+: unlimited)




  // Status & Publishing
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: {
    type: Date,
    default: null
  },

  // Course Statistics
  enrollmentCount: {
    type: Number,
    default: 0
  },
  completionCount: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },

  // SEO & Metadata
  slug: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  metaTitle: {
    type: String,
    trim: true
  },
  metaDescription: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
courseSchema.index({ title: 'text', description: 'text' });
courseSchema.index({ category: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ createdAt: -1 });

// Pre-save middleware to update totalVideos and totalPdfs
courseSchema.pre('save', function (next) {
  this.totalVideos = this.videos.length;
  this.totalPdfs = this.pdfs.length;
  next();
});

// Methods
courseSchema.methods.calculateAverageRating = function () {
  // This would typically query reviews and calculate
  return this.averageRating;
};

courseSchema.methods.updateEnrollmentCount = async function () {
  // This would typically count enrollments from a separate collection
  return this.enrollmentCount;
};


export const Course = mongoose.model("Course", courseSchema);

