import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createTestNotification,
  registerDeviceToken
} from '../../controller/notifications/notifications.controller.js';
import {
  getAllNotifications,
  sendBroadcastNotification,
  deleteNotificationAdmin,
  markNotificationReadAdmin
} from '../../controller/notifications/admin.notifications.controller.js';

const router = express.Router();

// ========================================
// Admin Routes
// ========================================
router.get('/all', adminAuth, getAllNotifications);
router.post('/broadcast', adminAuth, sendBroadcastNotification);
router.delete('/:id/admin', adminAuth, deleteNotificationAdmin);
router.patch('/:id/read/admin', adminAuth, markNotificationReadAdmin);

// ========================================
// Protected User Routes
// ========================================
router.use(protectedRoutes); // Apply auth middleware

// Device Token Registration
router.post('/device-token', registerDeviceToken);

// Notification Routes
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.delete('/all', deleteAllNotifications);
router.post('/test', createTestNotification);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
