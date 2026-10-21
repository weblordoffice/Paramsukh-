import express from 'express';
import {
  getProfile,
  updateProfile,
  updateProfilePhoto,
  removeProfilePhoto,
  updatePreferences,
  getSubscription,
  getUserStats,
  deactivateAccount,
  deleteAccount,
  requestDeleteAccountOtp,
  purchaseMembership,
  requestContactChange,
  verifyContactChange
} from '../../controller/user/profile.controller.js';
import {
  getUserCertificates,
  generateCertificate
} from '../../controller/user/certificate.controller.js';
import { getUserAchievements } from '../../controller/user/achievement.controller.js';
import { getUserAnalytics } from '../../controller/user/analytics.controller.js';
import {
  getUserReferralDashboard, getPointsHistory, handleRedeemPoints,
  regenerateReferralCode, applyReferralCode
} from '../../controller/user/referral.controller.js';
import {
  getAllUsers,
  getUserById,
  createUserAdmin,
  updateUserAdmin,
  deleteUserAdmin,
  updateUserMembership,
  getUserEnrollments,
  getUserPayments
} from '../../controller/user/admin.controller.js';
import {
  getUserAnalyticsAdmin,
  getUserActivity,
  getUsersNeedingAttention
} from '../../controller/user/adminUserTracking.controller.js';
import {
  previewUserImport,
  commitUserImport,
  getUserImportTemplate,
} from '../../controller/user/import.controller.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { uploadLimiter, generalLimiter } from '../../middleware/rateLimiter.js';
import { uploadSingleSpreadsheet, handleMulterError } from '../../middleware/uploadMiddleware.js';
import { validateMongoIdParams } from '../../middleware/validators.js';

const router = express.Router();

// ========================================
// User Routes (Requires authentication)
// MUST come before admin parameterized routes to avoid matching /:id
// ========================================

// router.use(protectedRoutes); - Removed to prevent interference with Admin routes below

router.get('/profile', protectedRoutes, getProfile);
router.put('/profile', protectedRoutes, updateProfile);
router.put('/profile/photo', protectedRoutes, updateProfilePhoto);
router.delete('/profile/photo', protectedRoutes, removeProfilePhoto);
router.put('/preferences', protectedRoutes, updatePreferences);
router.post('/profile/request-contact-change', protectedRoutes, requestContactChange);
router.post('/profile/verify-contact-change', protectedRoutes, verifyContactChange);
router.get('/subscription', protectedRoutes, getSubscription);
router.post('/membership/purchase', protectedRoutes, purchaseMembership);
router.get('/stats', protectedRoutes, getUserStats);
router.get('/analytics', protectedRoutes, getUserAnalytics);
router.get('/achievements', protectedRoutes, getUserAchievements);
router.get('/profile/certificates', protectedRoutes, getUserCertificates);
router.post('/profile/certificates/claim/:courseId', protectedRoutes, generateCertificate);
router.get('/profile/referrals', protectedRoutes, getUserReferralDashboard);
router.get('/profile/referrals/history', protectedRoutes, getPointsHistory);
router.post('/profile/referrals/redeem', protectedRoutes, handleRedeemPoints);
router.post('/profile/referrals/regenerate-code', protectedRoutes, regenerateReferralCode);
router.post('/profile/referrals/apply', protectedRoutes, applyReferralCode);
router.post('/deactivate', protectedRoutes, deactivateAccount);
router.post('/account/delete-otp', protectedRoutes, requestDeleteAccountOtp);
router.delete('/account', protectedRoutes, deleteAccount);

// ========================================
// Admin Routes (Requires X-Admin-API-Key header)
// Must define specific paths BEFORE parameterized /:id
// ========================================

router.get('/all', adminAuth, requirePermission('manage_users'), getAllUsers);
router.post('/create', adminAuth, requirePermission('manage_users'), createUserAdmin);
router.get('/import/template', adminAuth, requirePermission('manage_users'), generalLimiter, getUserImportTemplate);
router.post('/import/preview', adminAuth, requirePermission('manage_users'), uploadLimiter, uploadSingleSpreadsheet, handleMulterError, previewUserImport);
router.post('/import/commit', adminAuth, requirePermission('manage_users'), uploadLimiter, commitUserImport);
router.get('/analytics/admin/attention', adminAuth, requirePermission('manage_users'), getUsersNeedingAttention);

// Admin parameterized routes (must be after specific user paths)
router.get('/:userId/analytics/admin', adminAuth, requirePermission('manage_users'), validateMongoIdParams('userId'), getUserAnalyticsAdmin);
router.get('/:id', adminAuth, requirePermission('manage_users'), getUserById);
router.patch('/:id', adminAuth, requirePermission('manage_users'), updateUserAdmin);
router.delete('/:id', adminAuth, requirePermission('manage_users'), deleteUserAdmin);
router.patch('/:id/membership', adminAuth, requirePermission('manage_users'), updateUserMembership);
router.get('/:userId/enrollments', adminAuth, requirePermission('manage_users'), getUserEnrollments);
router.get('/:userId/payments', adminAuth, requirePermission('manage_users'), getUserPayments);
router.get('/:userId/activity', adminAuth, requirePermission('manage_users'), validateMongoIdParams('userId'), getUserActivity);

export default router;
