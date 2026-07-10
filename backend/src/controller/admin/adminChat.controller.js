import { AIConversation, AIMessage, AIMemory } from '../../models/aiChat.models.js';

/**
 * Get all conversations for a specific user
 * GET /api/admin/chat/users/:userId/conversations
 */
export const getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    const conversations = await AIConversation.find({
      user: userId,
      status: { $ne: 'deleted' }
    })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

    // Dynamically calculate stats for the user
    const totalConversations = conversations.length;
    const activeFacts = await AIMemory.countDocuments({ user: userId, isActive: true });
    const totalToolCalls = await AIMessage.countDocuments({
      user: userId,
      $or: [
        { role: 'tool' },
        { toolName: { $ne: null } }
      ]
    });

    return res.status(200).json({
      success: true,
      conversations,
      stats: {
        totalConversations,
        activeFacts,
        totalToolCalls
      }
    });
  } catch (error) {
    console.error('Error fetching user conversations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user conversations',
      error: error.message
    });
  }
};

/**
 * Get all messages for a specific conversation
 * GET /api/admin/chat/conversations/:conversationId/messages
 */
export const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await AIConversation.findById(conversationId).lean();
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const messages = await AIMessage.find({
      conversation: conversationId
    })
    .sort({ createdAt: 1 })
    .lean();

    return res.status(200).json({
      success: true,
      conversation,
      messages
    });
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation messages',
      error: error.message
    });
  }
};

/**
 * Get active memories for a specific user
 * GET /api/admin/chat/users/:userId/memory
 */
export const getUserMemory = async (req, res) => {
  try {
    const { userId } = req.params;
    const memories = await AIMemory.find({
      user: userId,
      isActive: true
    })
    .sort({ updatedAt: -1 })
    .lean();

    return res.status(200).json({
      success: true,
      memories
    });
  } catch (error) {
    console.error('Error fetching user memory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user memory',
      error: error.message
    });
  }
};
