import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { assessmentRequired } from '../../middleware/assessmentRequired.js';
import {
  enrollInCourse,
  getEnrollmentCatalog,
  getMyEnrollments,
  getEnrollmentByCourse,
  unenrollFromCourse,
  markVideoComplete,
  markPdfComplete,
  getCourseProgress,
  updateVideoPosition,
  checkEnrollmentStatus,
  getContinueLearning
} from '../../controller/enrollment/enrollment.controller.js';
import {
  getEnrollmentStats,
  getEnrollmentStatsByCourse,
  getRecentEnrollments
} from '../../controller/enrollment/enrollmentStats.controller.js';
import { adminAuth } from '../../middleware/adminAuth.js';

const router = express.Router();

// ========================================
// Admin Stats Routes (require admin API key)
// ========================================
router.get('/stats', adminAuth, getEnrollmentStats);
router.get('/stats/courses', adminAuth, getEnrollmentStatsByCourse);
router.get('/stats/recent', adminAuth, getRecentEnrollments);

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
router.get('/check/:courseId', checkEnrollmentStatus);

// Get enrollment details for a specific course
router.get('/course/:courseId', getEnrollmentByCourse);

// Get course progress
router.get('/course/:courseId/progress', getCourseProgress);

// Update current video position
router.patch('/course/:courseId/position', updateVideoPosition);

// Mark video as complete
router.post('/course/:courseId/video/:videoId/complete', markVideoComplete);

// Mark PDF as complete
router.post('/course/:courseId/pdf/:pdfId/complete', markPdfComplete);

// Unenroll from course
router.delete('/course/:courseId', unenrollFromCourse);

export default router;
