import mongoose from 'mongoose';

const supportMessageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'closed'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['general', 'billing', 'technical', 'account', 'feedback', 'other'],
    default: 'general'
  },
  adminReply: {
    message: String,
    repliedAt: Date,
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  readAt: {
    type: Date
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

supportMessageSchema.index({ user: 1, createdAt: -1 });
supportMessageSchema.index({ status: 1, createdAt: -1 });

supportMessageSchema.methods.markAsRead = function () {
  this.readAt = Date.now();
  return this.save();
};

supportMessageSchema.methods.resolve = function (adminMessage, adminId) {
  this.status = 'resolved';
  this.adminReply = {
    message: adminMessage,
    repliedAt: Date.now(),
    repliedBy: adminId
  };
  this.resolvedAt = Date.now();
  return this.save();
};

const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema);
export default SupportMessage;