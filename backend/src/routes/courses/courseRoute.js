import express from 'express';
import { createCourse, deleteCourse, updateCourse, getAllCourses, getCourseById, getCourseBySlug } from '../../controller/courses/courses.controller.js';
import { addPdfToCourse, getCoursePdfs, updatePdf, deletePdf, getPdfById } from '../../controller/courses/pdf.controller.js';
import { addVideoToCourse, getCourseVideos, updateVideo, deleteVideo, getVideoById } from '../../controller/courses/videos.controller.js';
import {
  addLiveSessionToCourse,
  getCourseLiveSessions,
  getLiveSessionById,
  updateLiveSession,
  deleteLiveSession,
  addSessionRecording
} from '../../controller/courses/session.controller.js';
import {
  addAssignment,
  getCourseAssignments,
  getVideoAssignments,
  updateAssignment,
  deleteAssignment
} from '../../controller/courses/assignment.controller.js';
import {
  markVideoComplete,
  markPdfComplete,
  markAudioComplete,
  getEnrollmentProgress
} from '../../controller/courses/progress.controller.js';
import {
  getCourseAudioLessons,
  addAudioLesson,
  updateAudioLesson,
  deleteAudioLesson,
  getCourseReflections,
  addReflection,
  updateReflection,
  deleteReflection,
  submitReflection,
  getAssignmentAttempts,
  submitAssignment,
  getAssignmentSubmissionsAdmin,
  getReflectionSubmissionsAdmin,
} from '../../controller/courses/courseActivity.controller.js';
import {
  getCourseAssessmentOverview,
  startCourseAssessment,
  submitCourseAssessment,
  getCourseAssessmentAttempts,
  getCourseViva,
  applyCourseViva,
} from '../../controller/courses/courseAssessment.controller.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { requireResourceScope, requireAllPermissionScope } from '../../middleware/permissionScope.js';
import { progressLimiter } from '../../middleware/rateLimiter.js';
import { validateMongoIdParams } from '../../middleware/validators.js';
import { requireCourseAccess } from '../../middleware/courseAccess.js';
import { optionalAuth } from '../../middleware/optionalAuth.js';

const router = express.Router();
const requireCourseScope = requireResourceScope(
  'manage_courses',
  'id',
  (req) => req.params.courseId || req.params.id
);

router.post('/create', adminAuth, requirePermission('manage_courses'), requireAllPermissionScope('manage_courses'), createCourse);
router.delete('/delete/:id', adminAuth, requirePermission('manage_courses'), requireCourseScope, validateMongoIdParams('id'), deleteCourse);
router.put('/update/:id', adminAuth, requirePermission('manage_courses'), requireCourseScope, validateMongoIdParams('id'), updateCourse);
router.get('/all', getAllCourses);
router.get('/slug/:slug', optionalAuth, getCourseBySlug);
router.get('/:id', optionalAuth, validateMongoIdParams('id'), getCourseById);


router.post('/:courseId/videos', adminAuth, requirePermission('manage_courses'), requireCourseScope, addVideoToCourse);
router.get('/:courseId/videos', protectedRoutes, requireCourseAccess, getCourseVideos);
router.get('/:courseId/videos/:videoId', protectedRoutes, requireCourseAccess, getVideoById);
router.put('/:courseId/videos/:videoId', adminAuth, requirePermission('manage_courses'), requireCourseScope, updateVideo);
router.delete('/:courseId/videos/:videoId', adminAuth, requirePermission('manage_courses'), requireCourseScope, deleteVideo);

//pdf routes
router.post('/:courseId/pdfs', adminAuth, requirePermission('manage_courses'), requireCourseScope, addPdfToCourse);
router.get('/:courseId/pdfs', protectedRoutes, requireCourseAccess, getCoursePdfs);
router.get('/:courseId/pdfs/:pdfId', protectedRoutes, requireCourseAccess, getPdfById);
router.put('/:courseId/pdfs/:pdfId', adminAuth, requirePermission('manage_courses'), requireCourseScope, updatePdf);
router.delete('/:courseId/pdfs/:pdfId', adminAuth, requirePermission('manage_courses'), requireCourseScope, deletePdf);

// livesession routes
router.post('/:courseId/livesessions', adminAuth, requirePermission('manage_courses'), requireCourseScope, addLiveSessionToCourse);
router.get('/:courseId/livesessions', protectedRoutes, requireCourseAccess, getCourseLiveSessions);
router.get('/:courseId/livesessions/:liveSessionId', protectedRoutes, requireCourseAccess, getLiveSessionById);
router.put('/:courseId/livesessions/:liveSessionId', adminAuth, requirePermission('manage_courses'), requireCourseScope, updateLiveSession);
router.delete('/:courseId/livesessions/:liveSessionId', adminAuth, requirePermission('manage_courses'), requireCourseScope, deleteLiveSession);
router.patch('/:courseId/livesessions/:liveSessionId/recording', adminAuth, requirePermission('manage_courses'), requireCourseScope, addSessionRecording);

// assignment routes
router.post('/:courseId/assignments', adminAuth, requirePermission('manage_courses'), requireCourseScope, addAssignment);
router.get('/:courseId/assignments', protectedRoutes, requireCourseAccess, getCourseAssignments);
router.get('/:courseId/videos/:videoId/assignments', protectedRoutes, requireCourseAccess, getVideoAssignments);
router.put('/:courseId/assignments/:assignmentId', adminAuth, requirePermission('manage_courses'), requireCourseScope, updateAssignment);
router.delete('/:courseId/assignments/:assignmentId', adminAuth, requirePermission('manage_courses'), requireCourseScope, deleteAssignment);

// Audio lesson routes
router.post('/:courseId/audio-lessons', adminAuth, requirePermission('manage_courses'), requireCourseScope, addAudioLesson);
router.get('/:courseId/audio-lessons', protectedRoutes, requireCourseAccess, getCourseAudioLessons);
router.put('/:courseId/audio-lessons/:audioId', adminAuth, requirePermission('manage_courses'), requireCourseScope, updateAudioLesson);
router.delete('/:courseId/audio-lessons/:audioId', adminAuth, requirePermission('manage_courses'), requireCourseScope, deleteAudioLesson);

// Reflection routes
router.post('/:courseId/reflections', adminAuth, requirePermission('manage_courses'), requireCourseScope, addReflection);
router.get('/:courseId/reflections', protectedRoutes, requireCourseAccess, getCourseReflections);
router.get('/:courseId/reflections/submissions/admin', adminAuth, requirePermission('manage_courses'), requireCourseScope, getReflectionSubmissionsAdmin);
router.put('/:courseId/reflections/:reflectionId', adminAuth, requirePermission('manage_courses'), requireCourseScope, updateReflection);
router.delete('/:courseId/reflections/:reflectionId', adminAuth, requirePermission('manage_courses'), requireCourseScope, deleteReflection);
router.post('/:courseId/reflections/:reflectionId/submit', protectedRoutes, requireCourseAccess, submitReflection);

// Quiz attempt routes
router.get('/:courseId/assignments/:assignmentId/attempts', protectedRoutes, requireCourseAccess, getAssignmentAttempts);
router.get('/:courseId/assignments/:assignmentId/submissions/admin', adminAuth, requirePermission('manage_courses'), requireCourseScope, getAssignmentSubmissionsAdmin);
router.post('/:courseId/assignments/:assignmentId/submit', protectedRoutes, requireCourseAccess, submitAssignment);

// Progress tracking routes (require authentication + rate limiting)
router.get('/:courseId/progress', protectedRoutes, requireCourseAccess, getEnrollmentProgress);
router.post('/:courseId/progress/video/:videoId', protectedRoutes, requireCourseAccess, progressLimiter, markVideoComplete);
router.post('/:courseId/progress/pdf/:pdfId', protectedRoutes, requireCourseAccess, progressLimiter, markPdfComplete);
router.post('/:courseId/progress/audio/:audioId', protectedRoutes, requireCourseAccess, progressLimiter, markAudioComplete);

// Certification assessment and viva routes
router.get('/:courseId/assessment', protectedRoutes, validateMongoIdParams('courseId'), requireCourseAccess, getCourseAssessmentOverview);
router.post('/:courseId/assessment/start', protectedRoutes, validateMongoIdParams('courseId'), requireCourseAccess, progressLimiter, startCourseAssessment);
router.post('/:courseId/assessment/submit', protectedRoutes, validateMongoIdParams('courseId'), requireCourseAccess, progressLimiter, submitCourseAssessment);
router.get('/:courseId/assessment/attempts', protectedRoutes, validateMongoIdParams('courseId'), requireCourseAccess, getCourseAssessmentAttempts);
router.get('/:courseId/viva', protectedRoutes, validateMongoIdParams('courseId'), requireCourseAccess, getCourseViva);
router.post('/:courseId/viva/apply', protectedRoutes, validateMongoIdParams('courseId'), requireCourseAccess, progressLimiter, applyCourseViva);

export default router;
