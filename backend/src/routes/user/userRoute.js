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
  purchaseMembership
} from '../../controller/user/profile.controller.js';
import {
  getAllUsers,
  getUserById,
  createUserAdmin,
  updateUserAdmin,
  deleteUserAdmin,
  updateUserMembership,
  getUserEnrollments,
  getUserPayments,
  getUserActivity
} from '../../controller/user/admin.controller.js';
import {
  previewUserImport,
  commitUserImport,
  getUserImportTemplate,
} from '../../controller/user/import.controller.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import { uploadSingleSpreadsheet, handleMulterError } from '../../middleware/uploadMiddleware.js';

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
router.get('/subscription', protectedRoutes, getSubscription);
router.post('/membership/purchase', protectedRoutes, purchaseMembership);
router.get('/stats', protectedRoutes, getUserStats);
router.post('/deactivate', protectedRoutes, deactivateAccount);
router.delete('/account', protectedRoutes, deleteAccount);

// ========================================
// Admin Routes (Requires X-Admin-API-Key header)
// Must define specific paths BEFORE parameterized /:id
// ========================================

router.get('/all', adminAuth, getAllUsers);
router.post('/create', adminAuth, createUserAdmin);
router.get('/import/template', adminAuth, getUserImportTemplate);
router.post('/import/preview', adminAuth, uploadLimiter, uploadSingleSpreadsheet, handleMulterError, previewUserImport);
router.post('/import/commit', adminAuth, commitUserImport);

// Admin parameterized routes (must be after specific user paths)
router.get('/:id', adminAuth, getUserById);
router.patch('/:id', adminAuth, updateUserAdmin);
router.delete('/:id', adminAuth, deleteUserAdmin);
router.patch('/:id/membership', adminAuth, updateUserMembership);
router.get('/:userId/enrollments', adminAuth, getUserEnrollments);
router.get('/:userId/payments', adminAuth, getUserPayments);
router.get('/:userId/activity', adminAuth, getUserActivity);

export default router;
