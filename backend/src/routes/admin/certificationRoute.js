import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import {
  requireResourceScope,
  requireAssessmentAttemptScope,
  requireVivaScope,
} from '../../middleware/permissionScope.js';
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
  requireResourceScope('manage_courses', 'courseId'),
  getAdminCourseAssessment
);
router.put(
  '/courses/:courseId/assessment',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('courseId'),
  requireResourceScope('manage_courses', 'courseId'),
  upsertAdminCourseAssessment
);

router.get(
  '/courses/:courseId/assessment/attempts',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('courseId'),
  requireResourceScope('manage_courses', 'courseId'),
  listAdminAssessmentAttempts
);
router.get(
  '/assessment-attempts/:attemptId',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('attemptId'),
  requireAssessmentAttemptScope,
  getAdminAssessmentAttempt
);
router.patch(
  '/assessment-attempts/:attemptId/grade',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('attemptId'),
  requireAssessmentAttemptScope,
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
  requireVivaScope,
  getAdminVivaApplication
);
router.patch(
  '/viva-applications/:vivaId/status',
  adminAuth,
  requirePermission('manage_courses'),
  validateMongoIdParams('vivaId'),
  requireVivaScope,
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
