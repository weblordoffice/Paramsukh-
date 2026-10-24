import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validateMongoIdParams } from '../../middleware/validators.js';
import {
  getAdminCourseAssessment,
  upsertAdminCourseAssessment,
  listAdminAssessmentAttempts,
  getAdminAssessmentAttempt,
  gradeAdminAssessmentAttempt,
  listAdminVivaApplications,
  getAdminVivaApplication,
  updateAdminVivaStatus,
  listAdminCertificates,
  issueAdminAssessmentCertificate,
  revokeAdminCertificate,
} from '../../controller/admin/certification.controller.js';

const router = express.Router();

router.get(
  '/courses/:courseId/assessment',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('courseId'),
  getAdminCourseAssessment
);
router.put(
  '/courses/:courseId/assessment',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('courseId'),
  upsertAdminCourseAssessment
);

router.get(
  '/courses/:courseId/assessment/attempts',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('courseId'),
  listAdminAssessmentAttempts
);
router.get(
  '/assessment-attempts/:attemptId',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('attemptId'),
  getAdminAssessmentAttempt
);
router.patch(
  '/assessment-attempts/:attemptId/grade',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('attemptId'),
  gradeAdminAssessmentAttempt
);

router.get(
  '/viva-applications',
  adminAuth,
  requirePermission('manage_courses'),
  listAdminVivaApplications
);
router.get(
  '/viva-applications/:vivaId',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('vivaId'),
  getAdminVivaApplication
);
router.patch(
  '/viva-applications/:vivaId/status',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('vivaId'),
  updateAdminVivaStatus
);

router.get(
  '/certificates',
  adminAuth,
  requirePermission('manage_users'),
  listAdminCertificates
);
router.post(
  '/certificates/assessment',
  adminAuth,
  requirePermission('manage_users'),
  issueAdminAssessmentCertificate
);
router.post(
  '/certificates/:certificateId/revoke',
  adminAuth,
  requirePermission('manage_users'),
  revokeAdminCertificate
);

export default router;
