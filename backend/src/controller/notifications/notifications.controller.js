import Notification, { DeviceToken } from '../../models/notification.models.js';
import { sendPushToUser, sendPushToUsers } from '../../services/pushService.js';

// @desc    Register device token for push notifications
// @route   POST /api/notifications/device-token
// @access  Private
export const registerDeviceToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user._id;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Device token is required' });
    }

    // Upsert token
    const deviceToken = await DeviceToken.findOneAndUpdate(
      { token },
      {
        user: userId,
        token,
        platform: platform || 'android',
        lastUsedAt: Date.now()
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Device token registered successfully',
      data: deviceToken
    });
  } catch (error) {
    console.error('Register Device Token Error:', error);
    res.status(500).json({ success: false, message: 'Failed to register device token' });
  }
};

// @desc    Get all notifications for current user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const query = { user: userId };

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        },
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get Notifications Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications',
      error: error.message
    });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const count = await Notification.countDocuments({
      user: userId,
      isRead: false
    });

    res.status(200).json({
      success: true,
      data: {
        unreadCount: count
      }
    });
  } catch (error) {
    console.error('Get Unread Count Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      user: userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (notification.isRead) {
      return res.status(200).json({
        success: true,
        message: 'Notification already marked as read',
        data: { notification }
      });
    }

    await notification.markAsRead();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (error) {
    console.error('Mark As Read Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: Date.now()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Mark All As Read Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete Notification Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
};

// @desc    Delete all notifications
// @route   DELETE /api/notifications/all
// @access  Private
export const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await Notification.deleteMany({ user: userId });

    res.status(200).json({
      success: true,
      message: 'All notifications deleted successfully',
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    console.error('Delete All Notifications Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notifications',
      error: error.message
    });
  }
};

// @desc    Create a test notification (for development)
// @route   POST /api/notifications/test
// @access  Private
export const createTestNotification = async (req, res) => {
  try {
    const userId = req.user._id;

    const notification = await Notification.createNotification({
      user: userId,
      type: 'general',
      title: 'Test Notification',
      message: 'This is a test notification created at ' + new Date().toLocaleString(),
      icon: '🧪',
      priority: 'medium'
    });

    res.status(201).json({
      success: true,
      message: 'Test notification created',
      data: { notification }
    });
  } catch (error) {
    console.error('Create Test Notification Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test notification',
      error: error.message
    });
  }
};

// Helper function to send notification (to be used by other controllers)
// Saves to DB AND fires a real Expo device push.
export const sendNotification = async (userId, notificationData) => {
  try {
    const notification = await Notification.createNotification({
      user: userId,
      ...notificationData
    });

    // Fire real push — non-blocking, failure is logged but does not throw
    sendPushToUser(userId, {
      title: notificationData.title,
      body: notificationData.message,
      data: {
        type: notificationData.type,
        relatedId: notificationData.relatedId?.toString?.() || null,
        relatedType: notificationData.relatedType || null,
        actionUrl: notificationData.actionUrl || null,
      },
    }).catch(() => {});

    return notification;
  } catch (error) {
    console.error('Send Notification Helper Error:', error);
    throw error;
  }
};

// Helper function to send bulk notifications
// Saves to DB AND fires real Expo device pushes to all recipients.
export const sendBulkNotifications = async (userIds, notificationData) => {
  try {
    const notifications = await Notification.sendToMultipleUsers(userIds, notificationData);

    // Fire real pushes to all users — non-blocking
    sendPushToUsers(userIds, {
      title: notificationData.title,
      body: notificationData.message,
      data: {
        type: notificationData.type,
        relatedId: notificationData.relatedId?.toString?.() || null,
        relatedType: notificationData.relatedType || null,
        actionUrl: notificationData.actionUrl || null,
      },
    }).catch(() => {});

    return notifications;
  } catch (error) {
    console.error('Send Bulk Notifications Helper Error:', error);
    throw error;
  }
};
