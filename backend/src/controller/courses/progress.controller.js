import { Enrollment } from '../../models/enrollment.models.js';
import { Course } from '../../models/course.models.js';

/**
 * Update video progress for a user's enrollment
 * POST /api/courses/:courseId/progress/video/:videoId
 */
export const markVideoComplete = async (req, res) => {
    try {
        const { courseId, videoId } = req.params;
        const userId = req.user._id;

        // Find the enrollment
        const enrollment = await Enrollment.findOne({ userId, courseId });

        if (!enrollment) {
            return res.status(404).json({
                success: false,
                message: 'Enrollment not found. Please enroll in this course first.'
            });
        }

        // Find the course to get total videos and PDFs
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Mark video as complete
        enrollment.markVideoComplete(videoId);

        // Update current video to next one
        const currentVideoIndex = course.videos.findIndex(v => v._id.toString() === videoId);
        if (currentVideoIndex !== -1 && currentVideoIndex < course.videos.length - 1) {
            enrollment.currentVideoIndex = currentVideoIndex + 1;
            enrollment.currentVideoId = course.videos[currentVideoIndex + 1]._id;
        } else {
            enrollment.currentVideoId = videoId;
        }
        enrollment.lastAccessedAt = new Date();

        // Recalculate progress
        const totalVideos = course.videos.length;
        const totalPdfs = course.pdfs.length;
        enrollment.updateProgress(totalVideos, totalPdfs);

        await enrollment.save();

        // Update course completion count if completed
        if (enrollment.isCompleted) {
            course.completionCount = (course.completionCount || 0) + 1;
            await course.save();

            // Automatically generate certificate
            try {
                const { generateCertificateRecord } = await import('../../services/certificate.service.js');
                await generateCertificateRecord(userId, courseId);
            } catch (certError) {
                console.error('❌ Failed to generate certificate on course completion:', certError);
            }

            // Process referral rewards if this user was referred by someone
            try {
                const { processReferralMilestone } = await import('../../services/referralRewardProcessor.js');
                await processReferralMilestone(userId);
            } catch (refError) {
                console.error('❌ Failed to process referral rewards on course completion:', refError);
            }
        }

        // Trigger badge unlocking evaluation
        try {
            const { unlockBadgesForUser } = await import('../../services/badgeUnlockingService.js');
            await unlockBadgesForUser(userId);
        } catch (badgeError) {
            console.error('❌ Failed to update achievements:', badgeError);
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

        const enrollment = await Enrollment.findOne({ userId, courseId });

        if (!enrollment) {
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

        enrollment.markPdfComplete(pdfId);
        enrollment.lastAccessedAt = new Date();

        const totalVideos = course.videos.length;
        const totalPdfs = course.pdfs.length;
        enrollment.updateProgress(totalVideos, totalPdfs);

        await enrollment.save();

        // Update course completion count if completed
        if (enrollment.isCompleted) {
            course.completionCount = (course.completionCount || 0) + 1;
            await course.save();

            // Automatically generate certificate
            try {
                const { generateCertificateRecord } = await import('../../services/certificate.service.js');
                await generateCertificateRecord(userId, courseId);
            } catch (certError) {
                console.error('❌ Failed to generate certificate on course completion:', certError);
            }

            // Process referral rewards if this user was referred by someone
            try {
                const { processReferralMilestone } = await import('../../services/referralRewardProcessor.js');
                await processReferralMilestone(userId);
            } catch (refError) {
                console.error('❌ Failed to process referral rewards on course completion:', refError);
            }
        }

        // Trigger badge unlocking evaluation
        try {
            const { unlockBadgesForUser } = await import('../../services/badgeUnlockingService.js');
            await unlockBadgesForUser(userId);
        } catch (badgeError) {
            console.error('❌ Failed to update achievements:', badgeError);
        }

        return res.status(200).json({
            success: true,
            message: 'PDF marked as complete',
            data: {
                progress: enrollment.progress,
                completedPdfs: enrollment.completedPdfs,
                isCompleted: enrollment.isCompleted
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
