import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import {
  submitAssessment,
  getAssessment,
  getRecommendations,
  deleteAssessment,
  checkAssessmentStatus,
  getAssessmentByUserIdAdmin
} from '../../controller/assessment/assessment.controller.js';

const router = express.Router();

// Get assessment by user ID (Admin)
router.get('/admin/user/:userId', adminAuth, requirePermission('manage_users'), getAssessmentByUserIdAdmin);

// All routes below are protected (require user authentication)
router.use(protectedRoutes);

// ========================================
// Assessment Routes
// ========================================

// Submit or update assessment
router.post('/submit', submitAssessment);

// Get user's assessment
router.get('/', getAssessment);

// Get personalized recommendations
router.get('/recommendations', getRecommendations);

// Check assessment completion status
router.get('/status', checkAssessmentStatus);

// Delete assessment
router.delete('/', deleteAssessment);



export default router;
