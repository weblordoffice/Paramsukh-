import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { assessmentRequired } from '../../middleware/assessmentRequired.js';
import {
  enrollInCourse,
  getEnrollmentCatalog,
  getMyEnrollments,
  getEnrollmentByCourse,
  unenrollFromCourse,
  updateVideoPosition,
  updateAudioPosition,
  checkEnrollmentStatus,
  getContinueLearning,
} from '../../controller/enrollment/enrollment.controller.js';
import {
  markVideoComplete,
  markPdfComplete,
  getEnrollmentProgress
} from '../../controller/courses/progress.controller.js';
import {
  getEnrollmentStats,
  getEnrollmentStatsByCourse,
  getRecentEnrollments
} from '../../controller/enrollment/enrollmentStats.controller.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { progressLimiter } from '../../middleware/rateLimiter.js';
import { requireCourseAccess } from '../../middleware/courseAccess.js';
import { validateMongoIdParams } from '../../middleware/validators.js';

const router = express.Router();

// ========================================
// Admin Stats Routes (require admin API key)
// ========================================
router.get('/stats', adminAuth, requirePermission('view_analytics', 'manage_courses'), getEnrollmentStats);
router.get('/stats/courses', adminAuth, requirePermission('view_analytics', 'manage_courses'), getEnrollmentStatsByCourse);
router.get('/stats/recent', adminAuth, requirePermission('view_analytics', 'manage_courses'), getRecentEnrollments);

// ========================================
// User Enrollment Routes (require authentication)
// ========================================

// All remaining enrollment routes require authentication
router.use(protectedRoutes);

// ========================================
// Enrollment Routes
// ========================================

// Enroll in a course (requires assessment completion)
router.post('/enroll', assessmentRequired, enrollInCourse);

// Get user's enrollments
router.get('/my-courses', getMyEnrollments);

// Get published catalog with backend access reasons
router.get('/catalog', getEnrollmentCatalog);

// Get continue learning data
router.get('/continue-learning', getContinueLearning);

// Check enrollment status for a course
router.get('/check/:courseId', validateMongoIdParams('courseId'), checkEnrollmentStatus);

// Get enrollment details for a specific course
router.get('/course/:courseId', validateMongoIdParams('courseId'), requireCourseAccess, getEnrollmentByCourse);

// Get course progress
router.get('/course/:courseId/progress', validateMongoIdParams('courseId'), requireCourseAccess, getEnrollmentProgress);

// Update current video position
router.patch('/course/:courseId/position', validateMongoIdParams('courseId'), requireCourseAccess, updateVideoPosition);

// Update current audio position
router.patch('/course/:courseId/audio/:audioId/position', validateMongoIdParams('courseId', 'audioId'), requireCourseAccess, updateAudioPosition);

// Mark video as complete
router.post('/course/:courseId/video/:videoId/complete', validateMongoIdParams('courseId', 'videoId'), requireCourseAccess, progressLimiter, markVideoComplete);

// Mark PDF as complete
router.post('/course/:courseId/pdf/:pdfId/complete', validateMongoIdParams('courseId', 'pdfId'), requireCourseAccess, progressLimiter, markPdfComplete);

// Unenroll from course (kept available after access expires)
router.delete('/course/:courseId', validateMongoIdParams('courseId'), unenrollFromCourse);

export default router;
