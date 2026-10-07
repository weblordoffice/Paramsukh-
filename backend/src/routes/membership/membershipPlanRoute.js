import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
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
router.get('/', adminAuth, listMembershipPlansAdmin);
router.post('/', adminAuth, createMembershipPlan);
router.get('/admin/grants', adminAuth, listAdminGrantedMemberships);
router.post('/admin/grants', adminAuth, grantMembershipByAdmin);
router.patch('/admin/grants/:id/revoke', adminAuth, revokeAdminGrantedMembership);
router.patch('/admin/grants/:id/extend', adminAuth, extendAdminGrantedMembership);
router.get('/:id', adminAuth, getMembershipPlanById);
router.patch('/:id', adminAuth, updateMembershipPlan);
router.patch('/:id/status', adminAuth, updateMembershipPlanStatus);
router.delete('/:id', adminAuth, deleteMembershipPlan);

export default router;
