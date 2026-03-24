/**
 * admin.notifications.controller.js
 * -----------------------------------------------------------------------
 * All admin-triggered notification actions:
 *  - GET  /all              → list all notifications
 *  - POST /broadcast        → send to ALL users
 *  - POST /send             → send to:
 *       • specific userIds[]
 *       • all users in a section (membership, events, counseling, orders…)
 *       • all users with a membership plan
 *  - DELETE /:id/admin      → delete one
 *  - PATCH  /:id/read/admin → mark one as read
 */

import Notification from '../../models/notification.models.js';
import { User } from '../../models/user.models.js';
import { sendPushToAll, sendPushToUsers } from '../../services/pushService.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the target user-ids for a given "section" + optional filters.
 * Returns an array of ObjectId-compatible values.
 */
async function resolveAudience({ section, filters = {} }) {
  let query = { isActive: true };

  switch (section) {
    case 'all':
      // no extra filter – all active users
      break;

    case 'memberships':
    case 'plans': {
      // Users who have an active subscription
      const planSlug = filters.planSlug; // optional: send only to users on a specific plan
      query.subscriptionStatus = 'active';
      if (planSlug) query.subscriptionPlan = planSlug;
      break;
    }

    case 'events': {
      // Users who have at least one confirmed event registration
      const { EventRegistration } = await import('../../models/eventRegistration.models.js');
      const eventId = filters.eventId; // optional: only registrants of a specific event
      const regQuery = { status: 'confirmed' };
      if (eventId) regQuery.eventId = eventId;
      const regs = await EventRegistration.find(regQuery).distinct('userId');
      return regs; // already an array of userIds
    }

    case 'courses': {
      // Users enrolled in at least one course
      const { Enrollment } = await import('../../models/enrollment.models.js');
      const courseId = filters.courseId;
      const enQuery = { status: { $in: ['active', 'completed'] } };
      if (courseId) enQuery.courseId = courseId;
      const enrollments = await Enrollment.find(enQuery).distinct('userId');
      return enrollments;
    }

    case 'counseling': {
      // Users who have at least one counseling booking
      const { CounselingBooking } = await import('../../models/counseling.models.js');
      const bookingStatus = filters.bookingStatus; // e.g. 'upcoming'
      const bQuery = {};
      if (bookingStatus) bQuery.status = bookingStatus;
      const bookings = await CounselingBooking.find(bQuery).distinct('user');
      return bookings;
    }

    case 'orders': {
      // Users who have placed at least one order
      const { Order } = await import('../../models/order.models.js');
      const orderStatus = filters.orderStatus;
      const oQuery = {};
      if (orderStatus) oQuery.status = orderStatus;
      const orders = await Order.find(oQuery).distinct('user');
      return orders;
    }

    case 'community': {
      // Members of a specific group, or all community members
      const { CommunityGroup } = await import('../../models/community.models.js');
      const groupId = filters.groupId;
      if (groupId) {
        const group = await CommunityGroup.findById(groupId).select('members').lean();
        return group?.members || [];
      }
      const groups = await CommunityGroup.find().select('members').lean();
      const allMembers = [...new Set(groups.flatMap(g => g.members.map(m => m.toString())))];
      return allMembers;
    }

    case 'podcasts': {
      // Users who have purchased/subscribed to podcasts
      const { PodcastAccess } = await import('../../models/podcast.models.js');
      const podcastId = filters.podcastId;
      const pQuery = { status: 'active' };
      if (podcastId) pQuery.podcastId = podcastId;
      const accesses = await PodcastAccess.find(pQuery).distinct('userId');
      return accesses;
    }

    case 'products':
    case 'dashboard':
    case 'users':
    default:
      // Send to all active users
      break;
  }

  const users = await User.find(query).select('_id').lean();
  return users.map(u => u._id);
}

// ─── Controllers ─────────────────────────────────────────────────────────────

// @desc    Get all notifications (Admin only)
// @route   GET /api/notifications/all
// @access  Admin
export const getAllNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, search } = req.query;

    const query = {};
    if (type) query.type = type;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const notifications = await Notification.find(query)
      .populate('user', 'displayName email phoneNumber')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Notification.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Get All Notifications Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications',
      error: error.message
    });
  }
};

// @desc    Send broadcast notification to ALL users (Admin only)
// @route   POST /api/notifications/broadcast
// @access  Admin
export const sendBroadcastNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      type = 'general',
      icon = '📢',
      priority = 'medium',
      actionUrl,
      relatedId,
      relatedType
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // Get all active users
    const users = await User.find({ isActive: true }).select('_id').lean();
    const userIds = users.map(user => user._id);

    if (userIds.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active users found'
      });
    }

    // Save notification docs for every user
    const notifications = userIds.map(userId => ({
      user: userId,
      type,
      title,
      message,
      icon,
      priority,
      isRead: false,
      ...(actionUrl && { actionUrl }),
      ...(relatedId && { relatedId }),
      ...(relatedType && { relatedType }),
    }));

    await Notification.insertMany(notifications);

    // Fire real push to ALL devices (non-blocking)
    sendPushToAll({ title, body: message, data: { type, actionUrl, relatedId, relatedType } }).catch(() => {});

    console.log(`📢 Admin broadcast notification sent to ${userIds.length} users`);

    res.status(201).json({
      success: true,
      message: `Notification sent to ${userIds.length} users`,
      data: { recipientCount: userIds.length }
    });
  } catch (error) {
    console.error('Send Broadcast Notification Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send broadcast notification',
      error: error.message
    });
  }
};

// @desc    Send targeted notification to a section/audience (Admin only)
// @route   POST /api/notifications/send
// @access  Admin
//
// Body:
// {
//   title: string,            ← required
//   message: string,          ← required
//   section: string,          ← 'all' | 'users' | 'memberships' | 'plans' |
//                                'courses' | 'events' | 'counseling' | 'orders' |
//                                'community' | 'podcasts' | 'products' | 'dashboard'
//   userIds: string[],        ← optional: override audience with specific users
//   filters: {                ← optional section-specific sub-filters
//     planSlug, eventId, courseId, bookingStatus, orderStatus, groupId, podcastId
//   },
//   type: string,             ← notification type enum
//   icon: string,
//   priority: string,
//   actionUrl: string,
//   relatedId: string,
//   relatedType: string
// }
export const sendSectionNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      section = 'all',
      userIds: explicitUserIds,
      filters = {},
      type = 'general',
      icon = '🔔',
      priority = 'medium',
      actionUrl,
      relatedId,
      relatedType,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title and message are required' });
    }

    // Resolve the target audience
    let targetUserIds = explicitUserIds?.length
      ? explicitUserIds
      : await resolveAudience({ section, filters });

    if (!targetUserIds?.length) {
      return res.status(200).json({
        success: true,
        message: 'No matching users found for the selected audience',
        data: { recipientCount: 0 }
      });
    }

    // Deduplicate
    const uniqueIds = [...new Set(targetUserIds.map(id => id.toString()))];

    // Save to DB
    const notificationDocs = uniqueIds.map(userId => ({
      user: userId,
      type,
      title,
      message,
      icon,
      priority,
      isRead: false,
      ...(actionUrl && { actionUrl }),
      ...(relatedId && { relatedId }),
      ...(relatedType && { relatedType }),
    }));
    await Notification.insertMany(notificationDocs);

    // Fire real push (non-blocking)
    sendPushToUsers(uniqueIds, {
      title,
      body: message,
      data: { type, actionUrl, relatedId, relatedType },
    }).catch(() => {});

    console.log(`📣 Admin sent "${section}" notification to ${uniqueIds.length} users`);

    res.status(201).json({
      success: true,
      message: `Notification sent to ${uniqueIds.length} users`,
      data: { recipientCount: uniqueIds.length, section }
    });
  } catch (error) {
    console.error('Send Section Notification Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send notification', error: error.message });
  }
};

// @desc    Delete a notification (Admin only)
// @route   DELETE /api/notifications/:id/admin
// @access  Admin
export const deleteNotificationAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    console.log(`🗑️ Admin deleted notification ${id}`);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete Notification Admin Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
};

// @desc    Mark notification as read (Admin only)
// @route   PATCH /api/notifications/:id/read/admin
// @access  Admin
export const markNotificationReadAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    notification.readAt = Date.now();
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (error) {
    console.error('Mark Notification Read Admin Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};
