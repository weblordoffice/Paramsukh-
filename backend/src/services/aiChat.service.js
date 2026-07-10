import mongoose from 'mongoose';

import { AIConversation, AIMessage, AIMemory } from '../models/aiChat.models.js';

const DEFAULT_CONVERSATION_TITLE = 'New chat';
const HISTORY_WINDOW_SIZE = 16;
const MEMORY_WINDOW_SIZE = 12;

const toObjectId = (value) => {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (mongoose.Types.ObjectId.isValid(String(value))) {
    return new mongoose.Types.ObjectId(String(value));
  }

  return null;
};

const truncate = (value, maxLength) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
};

const deriveConversationTitle = (message) => {
  const clean = String(message || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  return truncate(clean, 60);
};

const deriveConversationSummary = (summary) => {
  const clean = String(summary || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return null;
  }

  return truncate(clean, 1500);
};

const normalizeScreenLabel = (metadata) => {
  return metadata?.visible_screen_label || metadata?.current_screen?.label || null;
};

const formatConversation = (conversation) => ({
  id: String(conversation._id),
  title: conversation.title,
  status: conversation.status,
  lastMessageAt: conversation.lastMessageAt,
  lastScreenLabel: conversation.lastScreenLabel || null,
  summary: conversation.summary || null,
  messageCount: conversation.messageCount || 0,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

const normalizeScreenContext = (screenContext) => {
  if (!screenContext) {
    return null;
  }

  if (typeof screenContext === 'string') {
    const label = screenContext.trim();
    return label ? { label } : null;
  }

  if (typeof screenContext === 'object' && !Array.isArray(screenContext)) {
    return screenContext;
  }

  return null;
};

const formatMessage = (message) => ({
  id: String(message._id),
  role: message.role,
  content: message.content,
  toolName: message.toolName || null,
  toolPayload: message.toolPayload || null,
  screenContext: normalizeScreenContext(message.screenContext),
  metadata: message.metadata || {},
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const formatMemory = (memory) => ({
  id: String(memory._id),
  category: memory.category,
  key: memory.key,
  value: memory.value,
  confidence: memory.confidence,
  isActive: memory.isActive,
  sourceConversationId: memory.sourceConversation ? String(memory.sourceConversation) : null,
  sourceMessageId: memory.sourceMessage ? String(memory.sourceMessage) : null,
  createdAt: memory.createdAt,
  updatedAt: memory.updatedAt,
});

export const listUserConversations = async (userId) => {
  const conversations = await AIConversation.find({
    user: userId,
    status: { $ne: 'deleted' },
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  return conversations.map(formatConversation);
};

export const getConversationById = async (userId, conversationId) => {
  const conversation = await AIConversation.findOne({
    _id: conversationId,
    user: userId,
    status: { $ne: 'deleted' },
  });

  return conversation;
};

export const getConversationMessages = async (userId, conversationId) => {
  const conversation = await getConversationById(userId, conversationId);
  if (!conversation) {
    return null;
  }

  const messages = await AIMessage.find({
    user: userId,
    conversation: conversation._id,
  })
    .sort({ createdAt: 1 })
    .lean();

  return {
    conversation: formatConversation(conversation),
    messages: messages.map(formatMessage),
  };
};

export const getOrCreateConversation = async ({ userId, conversationId, message, metadata }) => {
  const normalizedConversationId = toObjectId(conversationId);

  if (normalizedConversationId) {
    const existing = await AIConversation.findOne({
      _id: normalizedConversationId,
      user: userId,
      status: { $ne: 'deleted' },
    });

    if (existing) {
      return existing;
    }
  }

  return AIConversation.create({
    user: userId,
    title: deriveConversationTitle(message),
    status: 'active',
    lastMessageAt: new Date(),
    lastScreenLabel: normalizeScreenLabel(metadata),
    messageCount: 0,
  });
};

export const appendMessageToConversation = async ({
  conversation,
  userId,
  role,
  content,
  metadata = {},
  toolName = null,
  toolPayload = null,
  screenContext = null,
}) => {
  const created = await AIMessage.create({
    conversation: conversation._id,
    user: userId,
    role,
    content,
    toolName,
    toolPayload,
    screenContext,
    metadata,
  });

  conversation.lastMessageAt = created.createdAt || new Date();
  conversation.lastScreenLabel = normalizeScreenLabel(metadata) || conversation.lastScreenLabel || null;
  conversation.messageCount = (conversation.messageCount || 0) + 1;

  if (!conversation.title || conversation.title === DEFAULT_CONVERSATION_TITLE) {
    const nextTitle = deriveConversationTitle(content);
    if (nextTitle) {
      conversation.title = nextTitle;
    }
  }

  await conversation.save();

  return created;
};

export const updateConversationSummary = async ({ conversation, summary }) => {
  if (!conversation) {
    return null;
  }

  conversation.summary = deriveConversationSummary(summary);
  await conversation.save();
  return formatConversation(conversation);
};

export const buildConversationContext = async ({ userId, conversationId }) => {
  const normalizedConversationId = toObjectId(conversationId);
  if (!normalizedConversationId) {
    return {
      recentMessages: [],
      relevantMemory: [],
    };
  }

  const [recentMessages, relevantMemory, conversation] = await Promise.all([
    AIMessage.find({
      user: userId,
      conversation: normalizedConversationId,
    })
      .sort({ createdAt: -1 })
      .limit(HISTORY_WINDOW_SIZE)
      .lean(),
    AIMemory.find({
      user: userId,
      isActive: true,
    })
      .sort({ updatedAt: -1, confidence: -1 })
      .limit(MEMORY_WINDOW_SIZE)
      .lean(),
    AIConversation.findOne({
      _id: normalizedConversationId,
      user: userId,
      status: { $ne: 'deleted' },
    }).lean(),
  ]);

  return {
    conversation: conversation ? formatConversation(conversation) : null,
    recentMessages: recentMessages.reverse().map(formatMessage),
    relevantMemory: relevantMemory.map(formatMemory),
  };
};

export const updateConversationTitle = async ({ userId, conversationId, title }) => {
  const conversation = await getConversationById(userId, conversationId);
  if (!conversation) {
    return null;
  }

  const nextTitle = truncate(title, 80);
  if (!nextTitle) {
    return conversation;
  }

  conversation.title = nextTitle;
  await conversation.save();
  return formatConversation(conversation);
};

export const deleteConversation = async ({ userId, conversationId }) => {
  const conversation = await getConversationById(userId, conversationId);
  if (!conversation) {
    return false;
  }

  conversation.status = 'deleted';
  await conversation.save();
  await AIMessage.deleteMany({ user: userId, conversation: conversation._id });
  return true;
};

export const clearConversationMessages = async ({ userId, conversationId }) => {
  const conversation = await getConversationById(userId, conversationId);
  if (!conversation) {
    return false;
  }

  await AIMessage.deleteMany({ user: userId, conversation: conversation._id });
  conversation.messageCount = 0;
  conversation.summary = null;
  conversation.lastMessageAt = new Date();
  conversation.title = DEFAULT_CONVERSATION_TITLE;
  await conversation.save();
  return true;
};

export const clearAllConversations = async (userId) => {
  const conversations = await AIConversation.find({
    user: userId,
    status: { $ne: 'deleted' },
  });

  const conversationIds = conversations.map((item) => item._id);
  if (conversationIds.length > 0) {
    await AIMessage.deleteMany({
      user: userId,
      conversation: { $in: conversationIds },
    });
  }

  await AIConversation.updateMany(
    { user: userId, status: { $ne: 'deleted' } },
    {
      $set: {
        status: 'deleted',
        summary: null,
        messageCount: 0,
      },
    }
  );
};

export const listUserMemory = async (userId) => {
  const memoryItems = await AIMemory.find({
    user: userId,
    isActive: true,
  })
    .sort({ updatedAt: -1, confidence: -1 })
    .lean();

  return memoryItems.map(formatMemory);
};

export const upsertMemoryItems = async ({ userId, conversationId, sourceMessageId, memoryItems }) => {
  if (!Array.isArray(memoryItems) || memoryItems.length === 0) {
    return [];
  }

  const persisted = [];

  for (const item of memoryItems) {
    const key = truncate(item?.key, 120).toLowerCase();
    const value = truncate(item?.value, 2000);
    if (!key || !value) {
      continue;
    }

    const category = ['preference', 'goal', 'profile', 'learning', 'support', 'other'].includes(item?.category)
      ? item.category
      : 'other';
    const confidence = Number.isFinite(Number(item?.confidence))
      ? Math.min(1, Math.max(0, Number(item.confidence)))
      : 0.75;

    const existing = await AIMemory.findOne({
      user: userId,
      key,
      isActive: true,
    });

    if (existing) {
      existing.value = value;
      existing.category = category;
      existing.confidence = confidence;
      existing.sourceConversation = conversationId || existing.sourceConversation || null;
      existing.sourceMessage = sourceMessageId || existing.sourceMessage || null;
      await existing.save();
      persisted.push(formatMemory(existing));
      continue;
    }

    const created = await AIMemory.create({
      user: userId,
      key,
      value,
      category,
      confidence,
      sourceConversation: conversationId || null,
      sourceMessage: sourceMessageId || null,
      isActive: true,
    });

    persisted.push(formatMemory(created));
  }

  return persisted;
};

export const deleteMemoryItem = async ({ userId, memoryId }) => {
  const memory = await AIMemory.findOne({
    _id: memoryId,
    user: userId,
    isActive: true,
  });

  if (!memory) {
    return false;
  }

  memory.isActive = false;
  await memory.save();
  return true;
};

export const clearAllMemory = async (userId) => {
  await AIMemory.updateMany(
    { user: userId, isActive: true },
    { $set: { isActive: false } }
  );
};
