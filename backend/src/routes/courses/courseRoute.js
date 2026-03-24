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
  getEnrollmentProgress
} from '../../controller/courses/progress.controller.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';

const router = express.Router();

router.post('/create', adminAuth, createCourse);
router.delete('/delete/:id', adminAuth, deleteCourse);
router.put('/update/:id', adminAuth, updateCourse);
router.get('/all', getAllCourses);
router.get('/:id', getCourseById);
router.get('/:slug', getCourseBySlug);


router.post('/:courseId/videos', adminAuth, addVideoToCourse);
router.get('/:courseId/videos', getCourseVideos);
router.get('/:courseId/videos/:videoId', getVideoById); // Specific video route must come before update/delete
router.put('/:courseId/videos/:videoId', adminAuth, updateVideo);
router.delete('/:courseId/videos/:videoId', adminAuth, deleteVideo);

//pdf routes
router.post('/:courseId/pdfs', adminAuth, addPdfToCourse);
router.get('/:courseId/pdfs', getCoursePdfs);
router.get('/:courseId/pdfs/:pdfId', getPdfById); // Specific pdf route must come before update/delete
router.put('/:courseId/pdfs/:pdfId', adminAuth, updatePdf);
router.delete('/:courseId/pdfs/:pdfId', adminAuth, deletePdf);

// livesession routes
router.post('/:courseId/livesessions', adminAuth, addLiveSessionToCourse);
router.get('/:courseId/livesessions', getCourseLiveSessions);
router.get('/:courseId/livesessions/:liveSessionId', getLiveSessionById);
router.put('/:courseId/livesessions/:liveSessionId', adminAuth, updateLiveSession);
router.delete('/:courseId/livesessions/:liveSessionId', adminAuth, deleteLiveSession);
router.patch('/:courseId/livesessions/:liveSessionId/recording', adminAuth, addSessionRecording);

// assignment routes
router.post('/:courseId/assignments', adminAuth, addAssignment);
router.get('/:courseId/assignments', getCourseAssignments);
router.get('/:courseId/videos/:videoId/assignments', getVideoAssignments);
router.put('/:courseId/assignments/:assignmentId', adminAuth, updateAssignment);
router.delete('/:courseId/assignments/:assignmentId', adminAuth, deleteAssignment);

// Progress tracking routes (require authentication)
router.get('/:courseId/progress', protectedRoutes, getEnrollmentProgress);
router.post('/:courseId/progress/video/:videoId', protectedRoutes, markVideoComplete);
router.post('/:courseId/progress/pdf/:pdfId', protectedRoutes, markPdfComplete);

export default router;