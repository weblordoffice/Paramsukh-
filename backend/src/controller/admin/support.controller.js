import SupportMessage from '../../models/supportMessage.models.js';
import { User } from '../../models/user.models.js';
import { sendNotification } from '../notifications/notifications.controller.js';

/**
 * Get all support messages (admin)
 * GET /api/admin/support/messages
 */
export const getAllSupportMessages = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const [messages, total] = await Promise.all([
      SupportMessage.find(filter)
        .populate('user', 'displayName email phone photoURL')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SupportMessage.countDocuments(filter)
    ]);

    const pendingCount = await SupportMessage.countDocuments({ status: 'pending' });
    const inProgressCount = await SupportMessage.countDocuments({ status: 'in_progress' });
    const resolvedCount = await SupportMessage.countDocuments({ status: 'resolved' });

    return res.status(200).json({
      success: true,
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        pending: pendingCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        total
      }
    });

  } catch (error) {
    console.error("❌ Error fetching support messages:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get support message by ID (admin)
 * GET /api/admin/support/message/:id
 */
export const getSupportMessageById = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await SupportMessage.findById(id)
      .populate('user', 'displayName email phone photoURL subscriptionPlan')
      .populate('adminReply.repliedBy', 'name');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    return res.status(200).json({
      success: true,
      message
    });

  } catch (error) {
    console.error("❌ Error fetching support message:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Reply to support message (admin)
 * POST /api/admin/support/message/:id/reply
 */
export const replyToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message: replyMessage, status = 'in_progress' } = req.body;
    const adminId = req.admin._id;

    if (!replyMessage || !replyMessage.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required"
      });
    }

    const supportMessage = await SupportMessage.findById(id);

    if (!supportMessage) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    const validStatuses = ['pending', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    supportMessage.adminReply = {
      message: replyMessage.trim(),
      repliedAt: Date.now(),
      repliedBy: adminId
    };
    supportMessage.status = status;
    
    if (status === 'resolved') {
      supportMessage.resolvedAt = Date.now();
    }

    await supportMessage.save();

    try {
      await sendNotification(supportMessage.user, {
        type: 'support_reply',
        title: status === 'resolved' ? 'Support ticket resolved' : 'New support reply',
        message: status === 'resolved'
          ? 'Our team resolved your support request. Open Help & Support to read the reply.'
          : 'Our team replied to your support request. Open Help & Support to read it.',
        relatedId: supportMessage._id,
        relatedType: 'support',
        actionUrl: '/(home)/help-support',
        priority: status === 'resolved' ? 'medium' : 'high'
      });
    } catch (notificationError) {
      console.error('Failed to send support reply notification:', notificationError);
    }

    console.log(`✅ Replied to support message: ${id}`);

    return res.status(200).json({
      success: true,
      message: "Reply sent successfully",
      supportMessage
    });

  } catch (error) {
    console.error("❌ Error replying to support message:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update message status (admin)
 * PUT /api/admin/support/message/:id/status
 */
export const updateMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const supportMessage = await SupportMessage.findById(id);

    if (!supportMessage) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    supportMessage.status = status;
    if (status === 'resolved') {
      supportMessage.resolvedAt = Date.now();
    }
    await supportMessage.save();

    return res.status(200).json({
      success: true,
      message: "Status updated"
    });

  } catch (error) {
    console.error("❌ Error updating message status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Delete support message (admin)
 * DELETE /api/admin/support/message/:id
 */
export const deleteSupportMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await SupportMessage.findByIdAndDelete(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message deleted"
    });

  } catch (error) {
    console.error("❌ Error deleting support message:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get support stats (admin)
 * GET /api/admin/support/stats
 */
export const getSupportStats = async (req, res) => {
  try {
    const [total, pending, inProgress, resolved, closed] = await Promise.all([
      SupportMessage.countDocuments(),
      SupportMessage.countDocuments({ status: 'pending' }),
      SupportMessage.countDocuments({ status: 'in_progress' }),
      SupportMessage.countDocuments({ status: 'resolved' }),
      SupportMessage.countDocuments({ status: 'closed' }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total,
        pending,
        inProgress,
        resolved,
        closed
      }
    });

  } catch (error) {
    console.error("❌ Error fetching support stats:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
