import express from 'express';
import {
    loginAdmin,
    verifyGoogleAndIssueToken,
    createAdmin,
    getAllAdmins,
    updateAdmin,
    deleteAdmin,
    logoutAdmin,
    getAdminMe,
    refreshTokenAdmin
} from '../../controller/auth/authAdmin.controller.js';
import { getBasicAnalytics } from '../../controller/admin/analytics.controller.js';
import {
    getAllSupportMessages,
    getSupportMessageById,
    replyToMessage,
    updateMessageStatus,
    deleteSupportMessage,
    getSupportStats
} from '../../controller/admin/support.controller.js';
import { protectAdmin, restrictTo } from '../../middleware/authAdmin.js';
import { authLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

// Public routes (rate-limited to prevent brute force)
router.post('/login', authLimiter, loginAdmin);
router.post('/auth/google', authLimiter, verifyGoogleAndIssueToken);
router.post('/logout', logoutAdmin);
router.post('/refresh-token', authLimiter, refreshTokenAdmin);

// Protected routes (Admin access)
router.use(protectAdmin);

router.get('/me', getAdminMe);
router.get('/analytics/basic', getBasicAnalytics);

// Support tickets (all admin roles)
router.get('/support/stats', getSupportStats);
router.get('/support/messages', getAllSupportMessages);
router.get('/support/messages/:id', getSupportMessageById);
router.post('/support/messages/:id/reply', replyToMessage);
router.put('/support/messages/:id/status', updateMessageStatus);
router.delete('/support/messages/:id', deleteSupportMessage);

// Super Admin routes (Manage other admins)
router.use(restrictTo('super_admin')); // All below routes require super_admin role

router.route('/users')
    .get(getAllAdmins)
    .post(createAdmin);

router.route('/users/:id')
    .put(updateAdmin)
    .delete(deleteAdmin);

export default router;
