import mongoose from 'mongoose';

const communityPointEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  action: {
    type: String,
    enum: [
      'discussion_created',
      'question_created',
      'comment_created',
      'answer_accepted',
      'like_received',
      'upvote_received',
    ],
    required: true,
    index: true,
  },
  points: {
    type: Number,
    required: true,
  },
  refType: {
    type: String,
    enum: ['post', 'comment'],
    default: null,
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null,
    index: true,
  },
  weekKey: {
    type: String,
    required: true,
    index: true,
  },
  monthKey: {
    type: String,
    required: true,
    index: true,
  },
  dedupeKey: {
    type: String,
    required: true,
    unique: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

communityPointEventSchema.index({ weekKey: 1, groupId: 1, isActive: 1, userId: 1 });
communityPointEventSchema.index({ monthKey: 1, groupId: 1, isActive: 1, userId: 1 });
communityPointEventSchema.index({ userId: 1, action: 1, createdAt: -1 });

export const CommunityPointEvent = mongoose.model('CommunityPointEvent', communityPointEventSchema);
export default CommunityPointEvent;
