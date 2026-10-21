import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import {
  createMembershipPlan,
  deleteMembershipPlan,
  getMembershipPlanById,
  listMembershipPlansAdmin,
  listMembershipPlansPublic,
  listMembershipPlansEligible,
  updateMembershipPlan,
  updateMembershipPlanStatus,
  getPlanEligibleCourses,
} from '../../controller/membership/membershipPlan.controller.js';
import {
  grantMembershipByAdmin,
  listAdminGrantedMemberships,
  revokeAdminGrantedMembership,
  extendAdminGrantedMembership,
} from '../../controller/membership/membershipGrant.controller.js';

const router = express.Router();

// Public plans for app/web purchase screens
router.get('/public', listMembershipPlansPublic);
// Authenticated plans annotated with per-user coverage (owned/included/upgrade)
router.get('/eligible', protectedRoutes, listMembershipPlansEligible);
router.get('/:planSlug/eligible-courses', getPlanEligibleCourses);

// Admin plan management
router.get('/', adminAuth, requirePermission('manage_users'), listMembershipPlansAdmin);
router.post('/', adminAuth, requirePermission('manage_users'), createMembershipPlan);
router.get('/admin/grants', adminAuth, requirePermission('manage_users'), listAdminGrantedMemberships);
router.post('/admin/grants', adminAuth, requirePermission('manage_users'), grantMembershipByAdmin);
router.patch('/admin/grants/:id/revoke', adminAuth, requirePermission('manage_users'), revokeAdminGrantedMembership);
router.patch('/admin/grants/:id/extend', adminAuth, requirePermission('manage_users'), extendAdminGrantedMembership);
router.get('/:id', adminAuth, requirePermission('manage_users'), getMembershipPlanById);
router.patch('/:id', adminAuth, requirePermission('manage_users'), updateMembershipPlan);
router.patch('/:id/status', adminAuth, requirePermission('manage_users'), updateMembershipPlanStatus);
router.delete('/:id', adminAuth, requirePermission('manage_users'), deleteMembershipPlan);

export default router;
