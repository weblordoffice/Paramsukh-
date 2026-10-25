import { Enrollment } from '../../models/enrollment.models.js';
import { Course } from '../../models/course.models.js';
import { handleCourseCompletion } from '../../services/courseCompletion.service.js';
import { recalculateAssessmentUnlock } from '../../services/certificationEligibility.service.js';
import { recomputeCourseProgress } from '../../services/courseProgress.service.js';

const WATCH_THRESHOLD = 0.9;

const hasEnoughWatchProof = (entries, id) => {
  const entry = (entries || []).find((item) => String(item.videoId || item.audioId) === String(id));
  if (!entry) return false;
  const duration = Number(entry.durationSeconds) || 0;
  if (duration <= 0) return false;
  return (Number(entry.positionSeconds) || 0) / duration >= WATCH_THRESHOLD;
};

const afterProgressChange = async (userId, courseId, enrollment) => {
  await recalculateAssessmentUnlock(userId, courseId).catch((err) =>
    console.error('Assessment unlock recalculation failed:', err.message)
  );

  if (enrollment.isCompleted) {
    await handleCourseCompletion(userId, courseId).catch((err) =>
      console.error('Post-completion hook failed:', err.message)
    );
  }

  try {
    const { unlockBadgesForUser } = await import('../../services/badgeUnlockingService.js');
    await unlockBadgesForUser(userId);
  } catch (badgeError) {
    console.error('Failed to update achievements:', badgeError);
  }
};

/**
 * Mark a video complete after server-side watch proof.
 * POST /api/courses/:courseId/progress/video/:videoId
 */
export const markVideoComplete = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const userId = req.user._id;

    const course = await Course.findById(courseId)
      .select('videos pdfs audioLessons reflections strictVideoOrder')
      .lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const videoIndex = (course.videos || []).findIndex((video) => String(video._id) === String(videoId));
    if (videoIndex === -1) {
      return res.status(404).json({ success: false, message: 'Video not found in this course' });
    }

    const existing = await Enrollment.findOne({ userId, courseId });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Enrollment not found. Please enroll in this course first.' });
    }

    if (!hasEnoughWatchProof(existing.videoProgress, videoId)) {
      return res.status(400).json({
        success: false,
        message: 'Watch at least 90% of this video before marking it complete.',
        code: 'WATCH_PROOF_REQUIRED',
      });
    }

    if (course.strictVideoOrder) {
      const completed = new Set((existing.completedVideos || []).map(String));
      const previous = (course.videos || []).slice(0, videoIndex);
      if (previous.some((video) => !completed.has(String(video._id)))) {
        return res.status(409).json({
          success: false,
          message: 'Complete the previous video lessons in order first.',
          code: 'VIDEO_ORDER_REQUIRED',
        });
      }
    }

    const updated = await Enrollment.findOneAndUpdate(
      { userId, courseId },
      {
        $addToSet: { completedVideos: videoId },
        $set: { lastAccessedAt: new Date() },
      },
      { new: true }
    );

    if (videoIndex < (course.videos || []).length - 1) {
      updated.currentVideoIndex = videoIndex + 1;
      updated.currentVideoId = course.videos[videoIndex + 1]._id;
    } else {
      updated.currentVideoId = videoId;
    }

    recomputeCourseProgress(updated, course);
    await updated.save();
    await afterProgressChange(userId, courseId, updated);

    return res.status(200).json({
      success: true,
      message: 'Video marked as complete',
      data: {
        progress: updated.progress,
        completedVideos: updated.completedVideos,
        isCompleted: updated.isCompleted,
      },
    });
  } catch (error) {
    console.error('Mark Video Complete Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update video progress',
      error: error.message,
    });
  }
};

/**
 * Mark a PDF complete (explicit completion).
 * POST /api/courses/:courseId/progress/pdf/:pdfId
 */
export const markPdfComplete = async (req, res) => {
  try {
    const { courseId, pdfId } = req.params;
    const userId = req.user._id;

    const course = await Course.findById(courseId)
      .select('videos pdfs audioLessons reflections')
      .lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (!(course.pdfs || []).some((pdf) => String(pdf._id) === String(pdfId))) {
      return res.status(404).json({ success: false, message: 'PDF not found in this course' });
    }

    const updated = await Enrollment.findOneAndUpdate(
      { userId, courseId },
      {
        $addToSet: { completedPdfs: pdfId },
        $set: { lastAccessedAt: new Date() },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    recomputeCourseProgress(updated, course);
    await updated.save();
    await afterProgressChange(userId, courseId, updated);

    return res.status(200).json({
      success: true,
      message: 'PDF marked as complete',
      data: {
        progress: updated.progress,
        completedPdfs: updated.completedPdfs,
        isCompleted: updated.isCompleted,
      },
    });
  } catch (error) {
    console.error('Mark PDF Complete Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update PDF progress',
      error: error.message,
    });
  }
};

/**
 * Mark an audio lesson complete after server-side listen proof.
 * POST /api/courses/:courseId/progress/audio/:audioId
 */
export const markAudioComplete = async (req, res) => {
  try {
    const { courseId, audioId } = req.params;
    const userId = req.user._id;

    const course = await Course.findById(courseId)
      .select('videos pdfs audioLessons reflections')
      .lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (!(course.audioLessons || []).some((lesson) => String(lesson._id) === String(audioId))) {
      return res.status(404).json({ success: false, message: 'Audio lesson not found' });
    }

    const existing = await Enrollment.findOne({ userId, courseId });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    if (!hasEnoughWatchProof(existing.audioProgress, audioId)) {
      return res.status(400).json({
        success: false,
        message: 'Listen to at least 90% of this audio lesson before marking it complete.',
        code: 'WATCH_PROOF_REQUIRED',
      });
    }

    const updated = await Enrollment.findOneAndUpdate(
      { userId, courseId },
      {
        $addToSet: { completedAudioLessons: audioId },
        $set: { lastAccessedAt: new Date() },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    recomputeCourseProgress(updated, course);
    await updated.save();
    await afterProgressChange(userId, courseId, updated);

    return res.status(200).json({
      success: true,
      message: 'Audio lesson marked as complete',
      data: {
        progress: updated.progress,
        completedAudioLessons: updated.completedAudioLessons,
        isCompleted: updated.isCompleted,
      },
    });
  } catch (error) {
    console.error('Mark Audio Complete Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update audio progress',
      error: error.message,
    });
  }
};

/**
 * Get enrollment progress for a course
 * GET /api/courses/:courseId/progress
 */
export const getEnrollmentProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const enrollment = await Enrollment.findOne({ userId, courseId });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Not enrolled in this course',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        progress: enrollment.progress,
        completedVideos: enrollment.completedVideos,
        completedPdfs: enrollment.completedPdfs,
        completedAudioLessons: enrollment.completedAudioLessons,
        completedReflections: enrollment.completedReflections,
        currentVideoId: enrollment.currentVideoId,
        currentVideoIndex: enrollment.currentVideoIndex,
        lastVideoPositionSeconds: enrollment.lastVideoPositionSeconds,
        lastVideoDurationSeconds: enrollment.lastVideoDurationSeconds,
        videoProgress: enrollment.videoProgress,
        audioProgress: enrollment.audioProgress,
        isCompleted: enrollment.isCompleted,
        lastAccessedAt: enrollment.lastAccessedAt,
      },
    });
  } catch (error) {
    console.error('Get Enrollment Progress Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get progress',
      error: error.message,
    });
  }
};
