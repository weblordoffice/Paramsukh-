import {
  appendMessageToConversation,
  buildConversationContext,
  clearAllConversations,
  clearAllMemory,
  clearConversationMessages,
  deleteConversation,
  deleteMemoryItem,
  getConversationMessages,
  getOrCreateConversation,
  listUserConversations,
  listUserMemory,
  updateConversationTitle,
  updateConversationSummary,
  upsertMemoryItems,
} from '../../services/aiChat.service.js';
import { buildToolPresentation } from '../../services/aiToolPresentation.service.js';
import { sendChatMessageToAIService, streamChatFromAIService } from '../../services/chatProxy.service.js';

const extractBackendAuthToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return req.cookies?.token || null;
};

const parseConversationId = (req) => {
  return req.body?.conversationId
    || req.body?.conversation_id
    || req.body?.sessionId
    || req.body?.session_id
    || req.params?.conversationId
    || null;
};

const parseMetadata = (req) => {
  return typeof req.body?.metadata === 'object' && req.body.metadata !== null
    ? req.body.metadata
    : {};
};

const normalizeMemoryItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      category: item?.category,
      key: item?.key,
      value: item?.value,
      confidence: item?.confidence,
    }))
    .filter((item) => item.key && item.value);
};

export const sendChatMessage = async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    const metadata = parseMetadata(req);
    const user = req.user;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'message is required',
      });
    }

    const backendAuthToken = extractBackendAuthToken(req);
    const requestedConversationId = parseConversationId(req);

    const conversation = await getOrCreateConversation({
      userId: user._id,
      conversationId: requestedConversationId,
      message,
      metadata,
    });

    const userMessage = await appendMessageToConversation({
      conversation,
      userId: user._id,
      role: 'user',
      content: message,
      metadata,
      screenContext: metadata.current_screen || null,
    });

    const conversationContext = await buildConversationContext({
      userId: user._id,
      conversationId: conversation._id,
    });

    const aiPayload = {
      message,
      session_id: String(conversation._id),
      backend_auth_token: backendAuthToken,
      user: {
        user_id: String(user._id),
        phone: user.phone || null,
        display_name: user.displayName || null,
        subscription_plan: user.subscriptionPlan || null,
        subscription_status: user.subscriptionStatus || null,
      },
      metadata: {
        ...metadata,
        source: metadata.source || 'mobile',
      },
      conversation: {
        id: String(conversation._id),
        title: conversation.title,
        summary: conversation.summary || null,
        recent_messages: conversationContext.recentMessages,
      },
      memory: conversationContext.relevantMemory,
    };

    const aiResponse = await sendChatMessageToAIService(aiPayload);

    if (Array.isArray(aiResponse?.tools_used)) {
      for (const toolCall of aiResponse.tools_used) {
        await appendMessageToConversation({
          conversation,
          userId: user._id,
          role: 'tool',
          content: toolCall?.success
            ? `Tool ${toolCall.tool_name} executed successfully.`
            : `Tool ${toolCall.tool_name} failed.`,
          metadata: {
            source: 'ai-tool',
          },
          toolName: toolCall?.tool_name || null,
          toolPayload: toolCall || null,
          screenContext: metadata.current_screen || null,
        });
      }
    }

    const toolPresentation = buildToolPresentation(aiResponse?.tools_used);
    const responseNarrative = aiResponse?.response_narrative || null;

    const assistantMessage = await appendMessageToConversation({
      conversation,
      userId: user._id,
      role: 'assistant',
      content: String(aiResponse?.answer || '').trim() || 'I could not generate a response right now.',
      metadata: {
        source: 'ai-assistant',
        toolPresentation,
        responseNarrative,
      },
      screenContext: metadata.current_screen || null,
    });

    await updateConversationSummary({
      conversation,
      summary: aiResponse?.conversation_summary,
    });

    const persistedMemory = await upsertMemoryItems({
      userId: user._id,
      conversationId: conversation._id,
      sourceMessageId: userMessage._id,
      memoryItems: normalizeMemoryItems(aiResponse?.memory_items),
    });

    return res.status(200).json({
      success: true,
      message: 'Chat response generated successfully',
      data: {
        ...aiResponse,
        presentation: toolPresentation,
        response_narrative: responseNarrative,
        session_id: String(conversation._id),
        conversation_id: String(conversation._id),
        memory_items: persistedMemory,
        saved_message_id: String(assistantMessage._id),
      },
    });
  } catch (error) {
    console.error('Error sending chat message to AI service:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to generate chat response',
      error: process.env.NODE_ENV === 'development' ? error.details || error.stack : undefined,
    });
  }
};

export const listConversations = async (req, res) => {
  try {
    const conversations = await listUserConversations(req.user._id);

    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load conversations',
    });
  }
};

export const getConversationDetail = async (req, res) => {
  try {
    const result = await getConversationMessages(req.user._id, req.params.conversationId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error loading conversation detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load conversation detail',
    });
  }
};

export const renameConversation = async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'title is required',
      });
    }

    const conversation = await updateConversationTitle({
      userId: req.user._id,
      conversationId: req.params.conversationId,
      title,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('Error renaming conversation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to rename conversation',
    });
  }
};

export const removeConversation = async (req, res) => {
  try {
    const deleted = await deleteConversation({
      userId: req.user._id,
      conversationId: req.params.conversationId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
    });
  }
};

export const clearConversation = async (req, res) => {
  try {
    const cleared = await clearConversationMessages({
      userId: req.user._id,
      conversationId: req.params.conversationId,
    });

    if (!cleared) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Conversation cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing conversation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear conversation',
    });
  }
};

export const removeAllConversations = async (req, res) => {
  try {
    await clearAllConversations(req.user._id);
    return res.status(200).json({
      success: true,
      message: 'All conversations cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing all conversations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear all conversations',
    });
  }
};

export const getMemory = async (req, res) => {
  try {
    const memoryItems = await listUserMemory(req.user._id);
    return res.status(200).json({
      success: true,
      data: memoryItems,
    });
  } catch (error) {
    console.error('Error loading AI memory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load AI memory',
    });
  }
};

export const removeMemoryItem = async (req, res) => {
  try {
    const deleted = await deleteMemoryItem({
      userId: req.user._id,
      memoryId: req.params.memoryId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Memory item not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Memory item deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting memory item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete memory item',
    });
  }
};

export const removeAllMemory = async (req, res) => {
  try {
    await clearAllMemory(req.user._id);
    return res.status(200).json({
      success: true,
      message: 'AI memory cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing AI memory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear AI memory',
    });
  }
};

export const getChatHealth = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Chat service route healthy',
  });
};

export const streamMessage = async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    const metadata = parseMetadata(req);
    const user = req.user;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'message is required',
      });
    }

    const backendAuthToken = extractBackendAuthToken(req);
    const requestedConversationId = parseConversationId(req);

    const conversation = await getOrCreateConversation({
      userId: user._id,
      conversationId: requestedConversationId,
      message,
      metadata,
    });

    await appendMessageToConversation({
      conversation,
      userId: user._id,
      role: 'user',
      content: message,
      metadata,
      screenContext: metadata.current_screen || null,
    });

    const conversationContext = await buildConversationContext({
      userId: user._id,
      conversationId: conversation._id,
    });

    const aiPayload = {
      message,
      session_id: String(conversation._id),
      backend_auth_token: backendAuthToken,
      user: {
        user_id: String(user._id),
        phone: user.phone || null,
        display_name: user.displayName || null,
        subscription_plan: user.subscriptionPlan || null,
        subscription_status: user.subscriptionStatus || null,
      },
      metadata: {
        ...metadata,
        source: metadata.source || 'mobile',
      },
      conversation: {
        id: String(conversation._id),
        title: conversation.title,
        summary: conversation.summary || null,
        recent_messages: conversationContext.recentMessages,
      },
      memory: conversationContext.relevantMemory,
    };

    const stream = await streamChatFromAIService(aiPayload);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let buffer = '';
    const toolsUsed = [];
    let assistantText = '';

    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      let lineEnd;
      while ((lineEnd = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, lineEnd).trim();
        buffer = buffer.substring(lineEnd + 1);

        if (!line) continue;

        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.substring(6).trim();
            const payload = JSON.parse(jsonStr);

            if (payload && payload.event === 'text_delta') {
              assistantText += payload.data?.text || '';
            }

            if (payload && payload.event === 'results') {
              const currentTools = payload.data?.tools_used || [];
              toolsUsed.push(...currentTools);
              const toolPresentation = buildToolPresentation(currentTools);

              // Replace raw tools_used data with formatted presentation sections
              const transformedPayload = {
                event: 'results',
                data: toolPresentation,
              };

              res.write(`data: ${JSON.stringify(transformedPayload)}\n\n`);
            } else {
              res.write(`${line}\n\n`);
            }
          } catch (e) {
            res.write(`${line}\n\n`);
          }
        } else {
          res.write(`${line}\n`);
        }
      }
    });

    stream.on('end', async () => {
      if (buffer.trim()) {
        res.write(`${buffer.trim()}\n\n`);
      }
      res.end();

      // Async DB Save
      try {
        if (toolsUsed.length > 0) {
          for (const toolCall of toolsUsed) {
            await appendMessageToConversation({
              conversation,
              userId: user._id,
              role: 'tool',
              content: toolCall?.success
                ? `Tool ${toolCall.tool_name} executed successfully.`
                : `Tool ${toolCall.tool_name} failed.`,
              metadata: {
                source: 'ai-tool',
              },
              toolName: toolCall?.tool_name || null,
              toolPayload: toolCall || null,
              screenContext: metadata.current_screen || null,
            });
          }
        }

        const finalAssistantText = assistantText.trim();
        const toolPresentation = buildToolPresentation(toolsUsed);
        await appendMessageToConversation({
          conversation,
          userId: user._id,
          role: 'assistant',
          content: finalAssistantText || 'I could not generate a response right now.',
          metadata: {
            source: 'ai-assistant',
            toolPresentation,
          },
          screenContext: metadata.current_screen || null,
        });
      } catch (dbErr) {
        console.error('Error saving streamed messages to database:', dbErr);
      }
    });

    stream.on('error', (err) => {
      console.error('AI Stream Error:', err);
      res.end();
    });
  } catch (error) {
    console.error('Error streaming AI chat message:', error);
    if (!res.headersSent) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to stream chat message',
      });
    }
    res.end();
  }
};
