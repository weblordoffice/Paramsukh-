import mongoose from 'mongoose';

const memorySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['preference', 'goal', 'profile', 'learning', 'support', 'other'],
      default: 'other',
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.75,
    },
    sourceConversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIConversation',
      default: null,
    },
    sourceMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIMessage',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 160,
      default: 'New chat',
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastScreenLabel: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: null,
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIConversation',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'tool'],
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 12000,
    },
    toolName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    toolPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    screenContext: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ user: 1, status: 1, lastMessageAt: -1 });
messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ user: 1, conversation: 1, createdAt: -1 });
memorySchema.index({ user: 1, isActive: 1, updatedAt: -1 });
memorySchema.index({ user: 1, category: 1, key: 1, isActive: 1 });

memorySchema.add({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
});

export const AIConversation = mongoose.model('AIConversation', conversationSchema);
export const AIMessage = mongoose.model('AIMessage', messageSchema);
export const AIMemory = mongoose.model('AIMemory', memorySchema);
