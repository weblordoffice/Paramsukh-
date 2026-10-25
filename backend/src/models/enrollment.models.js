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
  // Store ObjectIds of completed audio lessons
  completedAudioLessons: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  // Store ObjectIds of completed reflection exercises
  completedReflections: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  completedRequiredAssignments: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  assessmentUnlocked: {
    type: Boolean,
    default: false
  },
  assessmentUnlockedAt: {
    type: Date,
    default: null
  },
  lastEligibilityCheckAt: {
    type: Date,
    default: null
  },
  completionAwardedAt: {
    type: Date,
    default: null
  },
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
  },

  // Playback resume state — only set once the user actually starts a video.
  // Continue Learning uses these fields so enrolled-but-never-watched courses
  // do not appear in the widget.
  hasStartedLearning: {
    type: Boolean,
    default: false
  },
  lastPlayedAt: {
    type: Date,
    default: null
  },
  lastPausedAt: {
    type: Date,
    default: null
  },
  lastVideoPositionSeconds: {
    type: Number,
    default: 0,
    min: 0
  },
  lastVideoDurationSeconds: {
    type: Number,
    default: 0,
    min: 0
  },
  videoProgress: [{
    videoId: { type: mongoose.Schema.Types.ObjectId, required: true },
    positionSeconds: { type: Number, default: 0, min: 0 },
    durationSeconds: { type: Number, default: 0, min: 0 },
    updatedAt: { type: Date, default: Date.now }
  }],
  audioProgress: [{
    audioId: { type: mongoose.Schema.Types.ObjectId, required: true },
    positionSeconds: { type: Number, default: 0, min: 0 },
    durationSeconds: { type: Number, default: 0, min: 0 },
    updatedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Compound index to ensure one enrollment per user per course
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ userId: 1, isCompleted: 1 });
enrollmentSchema.index({ courseId: 1, isCompleted: 1 });
enrollmentSchema.index({ userId: 1, hasStartedLearning: 1, lastPausedAt: -1 });

// Methods
enrollmentSchema.methods.updateProgress = function({
  totalVideos = 0,
  totalPdfs = 0,
  totalAudioLessons = 0,
  requiredReflectionIds = [],
  videoIds = null,
  pdfIds = null,
  audioIds = null,
  reflectionIds = null,
} = {}) {
  const toSet = (ids) => new Set((ids || []).map((id) => String(id)));
  const countCompleted = (completed, liveIds) => {
    const ids = liveIds ? toSet(liveIds) : null;
    return (completed || []).reduce((count, id) => {
      if (!ids) return count + 1;
      return ids.has(String(id)) ? count + 1 : count;
    }, 0);
  };

  const completedVideos = countCompleted(this.completedVideos, videoIds);
  const completedPdfs = countCompleted(this.completedPdfs, pdfIds);
  const completedAudio = countCompleted(this.completedAudioLessons, audioIds);
  const requiredReflections = requiredReflectionIds || [];
  const requiredReflectionSet = toSet(requiredReflections);
  const completedReflections = countCompleted(
    (this.completedReflections || []).filter((id) => (
      reflectionIds ? toSet(reflectionIds).has(String(id)) : true
    )),
    requiredReflections
  );

  const totalItems = totalVideos + totalPdfs + totalAudioLessons + requiredReflectionSet.size;
  if (totalItems === 0) {
    this.progress = 0;
    this.isCompleted = false;
    this.completedAt = null;
    return this.progress;
  }

  const completedItems =
    Math.min(completedVideos, totalVideos)
    + Math.min(completedPdfs, totalPdfs)
    + Math.min(completedAudio, totalAudioLessons)
    + Math.min(completedReflections, requiredReflectionSet.size);

  this.progress = Math.min(100, Math.round((completedItems / totalItems) * 100));

  if (this.progress === 100) {
    if (!this.isCompleted) {
      this.isCompleted = true;
      this.completedAt = new Date();
    }
  } else if (this.isCompleted) {
    this.isCompleted = false;
    this.completedAt = null;
  }

  return this.progress;
};

enrollmentSchema.methods.markVideoComplete = function(videoId) {
  const vidStr = String(videoId);
  if (!this.completedVideos.some(id => String(id) === vidStr)) {
    this.completedVideos.push(videoId);
  }
  return this;
};

enrollmentSchema.methods.markPdfComplete = function(pdfId) {
  const pdfStr = String(pdfId);
  if (!this.completedPdfs.some(id => String(id) === pdfStr)) {
    this.completedPdfs.push(pdfId);
  }
  return this;
};

enrollmentSchema.methods.markAudioComplete = function(audioId) {
  const audioStr = String(audioId);
  if (!this.completedAudioLessons.some(id => String(id) === audioStr)) {
    this.completedAudioLessons.push(audioId);
  }
  return this;
};

enrollmentSchema.methods.markReflectionComplete = function(reflectionId) {
  const reflectionStr = String(reflectionId);
  if (!this.completedReflections.some(id => String(id) === reflectionStr)) {
    this.completedReflections.push(reflectionId);
  }
  return this;
};

enrollmentSchema.methods.markRequiredAssignmentComplete = function(assignmentId) {
  if (!Array.isArray(this.completedRequiredAssignments)) {
    this.completedRequiredAssignments = [];
  }
  const assignmentStr = String(assignmentId);
  if (!this.completedRequiredAssignments.some(id => String(id) === assignmentStr)) {
    this.completedRequiredAssignments.push(assignmentId);
  }
  return this;
};

// Post-delete middleware: sync enrollment and completion counts on Course
enrollmentSchema.post('findOneAndDelete', async function(doc) {
  if (!doc) return;
  try {
    const { Course } = await import('./course.models.js');
    const completionDelta = doc.isCompleted ? 1 : 0;
    await Course.findByIdAndUpdate(doc.courseId, [
      {
        $set: {
          enrollmentCount: {
            $max: [0, { $subtract: [{ $ifNull: ['$enrollmentCount', 0] }, 1] }],
          },
          completionCount: {
            $max: [0, { $subtract: [{ $ifNull: ['$completionCount', 0] }, completionDelta] }],
          },
        },
      },
    ]);
  } catch (error) {
    console.error('Failed to sync course counts on enrollment delete:', error);
  }
});

export const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

