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
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';

const router = express.Router();

// ========================================
// User Routes (Requires authentication)
// MUST come before admin parameterized routes to avoid matching /:id
// ========================================

router.use(protectedRoutes);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/profile/photo', updateProfilePhoto);
router.delete('/profile/photo', removeProfilePhoto);
router.put('/preferences', updatePreferences);
router.get('/subscription', getSubscription);
router.post('/membership/purchase', purchaseMembership);
router.get('/stats', getUserStats);
router.post('/deactivate', deactivateAccount);
router.delete('/account', deleteAccount);

// ========================================
// Admin Routes (Requires X-Admin-API-Key header)
// Must define specific paths BEFORE parameterized /:id
// ========================================

router.get('/all', adminAuth, getAllUsers);
router.post('/create', adminAuth, createUserAdmin);

// Admin parameterized routes (must be after specific user paths)
router.get('/:id', adminAuth, getUserById);
router.patch('/:id', adminAuth, updateUserAdmin);
router.delete('/:id', adminAuth, deleteUserAdmin);
router.patch('/:id/membership', adminAuth, updateUserMembership);
router.get('/:userId/enrollments', adminAuth, getUserEnrollments);
router.get('/:userId/payments', adminAuth, getUserPayments);
router.get('/:userId/activity', adminAuth, getUserActivity);

export default router;
