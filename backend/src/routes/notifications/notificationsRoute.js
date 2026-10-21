import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
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
  sendSectionNotification,
  deleteNotificationAdmin,
  markNotificationReadAdmin
} from '../../controller/notifications/admin.notifications.controller.js';
import {
  triggerDailyMotivationQuotes,
  getNotificationAutomationStatus
} from '../../controller/notifications/automation.notifications.controller.js';

const router = express.Router();

// ========================================
// Admin Routes
// ========================================
router.get('/all', adminAuth, requirePermission('manage_content'), getAllNotifications);
router.post('/broadcast', adminAuth, requirePermission('manage_content'), sendBroadcastNotification);
// Targeted / section-specific send
// POST /api/notifications/send
// Body: { title, message, section, userIds?, filters?, type, icon, priority, actionUrl }
router.post('/send', adminAuth, requirePermission('manage_content'), sendSectionNotification);
router.delete('/:id/admin', adminAuth, requirePermission('manage_content'), deleteNotificationAdmin);
router.patch('/:id/read/admin', adminAuth, requirePermission('manage_content'), markNotificationReadAdmin);

// Notification automation
router.get('/automation/status', adminAuth, requirePermission('manage_content'), getNotificationAutomationStatus);
router.post('/automation/daily-quote', adminAuth, requirePermission('manage_content'), triggerDailyMotivationQuotes);

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
