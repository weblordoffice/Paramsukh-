import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true
  },
  
  // Enrollment status
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  
  // Progress tracking
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  // Store ObjectIds of completed videos (these are subdocument _ids from course.videos array)
  completedVideos: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  // Store ObjectIds of completed PDFs (these are subdocument _ids from course.pdfs array)
  completedPdfs: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  
  // Current position in course
  currentVideoIndex: {
    type: Number,
    default: 0
  },
  currentVideoId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  }
}, {
  timestamps: true
});

// Compound index to ensure one enrollment per user per course
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ userId: 1, isCompleted: 1 });
enrollmentSchema.index({ courseId: 1, isCompleted: 1 });

// Methods
enrollmentSchema.methods.updateProgress = function(totalVideos, totalPdfs) {
  const totalItems = totalVideos + totalPdfs;
  if (totalItems === 0) {
    this.progress = 0;
    return;
  }
  
  const completedItems = this.completedVideos.length + this.completedPdfs.length;
  this.progress = Math.round((completedItems / totalItems) * 100);
  
  if (this.progress === 100 && !this.isCompleted) {
    this.isCompleted = true;
    this.completedAt = new Date();
  }
  
  return this.progress;
};

enrollmentSchema.methods.markVideoComplete = function(videoId) {
  if (!this.completedVideos.includes(videoId)) {
    this.completedVideos.push(videoId);
  }
  return this;
};

enrollmentSchema.methods.markPdfComplete = function(pdfId) {
  if (!this.completedPdfs.includes(pdfId)) {
    this.completedPdfs.push(pdfId);
  }
  return this;
};

export const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

