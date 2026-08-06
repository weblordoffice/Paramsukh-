import { Enrollment } from '../../models/enrollment.models.js';
import { Course } from '../../models/course.models.js';
import { handleCourseCompletion } from '../../services/courseCompletion.service.js';

/**
 * Update video progress for a user's enrollment
 * POST /api/courses/:courseId/progress/video/:videoId
 */
export const markVideoComplete = async (req, res) => {
    try {
        const { courseId, videoId } = req.params;
        const userId = req.user._id;

        // Atomic completion — prevents concurrent requests from losing data
        const updated = await Enrollment.findOneAndUpdate(
            { userId, courseId },
            {
                $addToSet: { completedVideos: videoId },
                $set: { lastAccessedAt: new Date() }
            },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Enrollment not found. Please enroll in this course first.'
            });
        }

        const currentVideoIndex = course.videos.findIndex(v => String(v._id) === String(videoId));
        if (currentVideoIndex !== -1 && currentVideoIndex < course.videos.length - 1) {
            updated.currentVideoIndex = currentVideoIndex + 1;
            updated.currentVideoId = course.videos[currentVideoIndex + 1]._id;
        } else {
            updated.currentVideoId = videoId;
        }

        updated.updateProgress(course.videos.length, course.pdfs ? course.pdfs.length : 0);

        await updated.save();

        if (updated.isCompleted) {
            await handleCourseCompletion(userId, courseId).catch(err =>
                console.error('Post-completion hook failed:', err.message)
            );
        }

        try {
            const { unlockBadgesForUser } = await import('../../services/badgeUnlockingService.js');
            await unlockBadgesForUser(userId);
        } catch (badgeError) {
            console.error('Failed to update achievements:', badgeError);
        }

        return res.status(200).json({
            success: true,
            message: 'Video marked as complete',
            data: {
                progress: enrollment.progress,
                completedVideos: enrollment.completedVideos,
                isCompleted: enrollment.isCompleted
            }
        });
    } catch (error) {
        console.error('Mark Video Complete Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update video progress',
            error: error.message
        });
    }
};

/**
 * Mark PDF as complete
 * POST /api/courses/:courseId/progress/pdf/:pdfId
 */
export const markPdfComplete = async (req, res) => {
    try {
        const { courseId, pdfId } = req.params;
        const userId = req.user._id;

        // Atomic completion — prevents concurrent requests from losing data
        const updated = await Enrollment.findOneAndUpdate(
            { userId, courseId },
            {
                $addToSet: { completedPdfs: pdfId },
                $set: { lastAccessedAt: new Date() }
            },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Enrollment not found'
            });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        updated.updateProgress(
            course.videos ? course.videos.length : 0,
            course.pdfs ? course.pdfs.length : 0
        );

        await updated.save();

        if (updated.isCompleted) {
            await handleCourseCompletion(userId, courseId).catch(err =>
                console.error('Post-completion hook failed:', err.message)
            );
        }

        try {
            const { unlockBadgesForUser } = await import('../../services/badgeUnlockingService.js');
            await unlockBadgesForUser(userId);
        } catch (badgeError) {
            console.error('Failed to update achievements:', badgeError);
        }

        return res.status(200).json({
            success: true,
            message: 'PDF marked as complete',
            data: {
                progress: updated.progress,
                completedPdfs: updated.completedPdfs,
                isCompleted: updated.isCompleted
            }
        });
    } catch (error) {
        console.error('Mark PDF Complete Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update PDF progress',
            error: error.message
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
                message: 'Not enrolled in this course'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                progress: enrollment.progress,
                completedVideos: enrollment.completedVideos,
                completedPdfs: enrollment.completedPdfs,
                currentVideoId: enrollment.currentVideoId,
                isCompleted: enrollment.isCompleted,
                lastAccessedAt: enrollment.lastAccessedAt
            }
        });
    } catch (error) {
        console.error('Get Enrollment Progress Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get progress',
            error: error.message
        });
    }
};
