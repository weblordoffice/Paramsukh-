import SupportMessage from '../../models/supportMessage.models.js';

/**
 * Submit support message
 * POST /api/support/message
 */
export const submitMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { message, category = 'general', priority = 'medium' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    if (message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Message must be at least 10 characters"
      });
    }

    const supportMessage = await SupportMessage.create({
      user: userId,
      message: message.trim(),
      category,
      priority
    });

    console.log(`✅ Support message created: ${supportMessage._id}`);

    return res.status(201).json({
      success: true,
      message: "Message submitted successfully. We'll get back to you soon!",
      ticket: {
        _id: supportMessage._id,
        status: supportMessage.status,
        createdAt: supportMessage.createdAt
      }
    });

  } catch (error) {
    console.error("❌ Error submitting support message:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get user's support messages
 * GET /api/support/messages
 */
export const getMyMessages = async (req, res) => {
  try {
    const userId = req.user._id;

    const messages = await SupportMessage.find({ user: userId })
      .sort({ createdAt: -1 })
      .select('-adminReply.repliedBy');

    return res.status(200).json({
      success: true,
      messages
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
 * Get single support message details
 * GET /api/support/message/:id
 */
export const getMessageById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const message = await SupportMessage.findOne({ _id: id, user: userId })
      .populate('adminReply.repliedBy', 'name');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    if (!message.readAt) {
      message.readAt = Date.now();
      await message.save();
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
 * Close support ticket
 * POST /api/support/message/:id/close
 */
export const closeTicket = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const message = await SupportMessage.findOne({ _id: id, user: userId });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    message.status = 'closed';
    await message.save();

    return res.status(200).json({
      success: true,
      message: "Ticket closed successfully"
    });

  } catch (error) {
    console.error("❌ Error closing ticket:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};