import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'course_enrolled',
      'course_completed',
      'video_completed',
      'event_reminder',
      'event_registered',
      'community_post',
      'community_comment',
      'community_like',
      'counseling_booked',
      'counseling_reminder',
      'membership_activated',
      'system',
      'general'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  // Related entities
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    // Can reference Course, Event, Post, Booking, etc.
  },
  relatedType: {
    type: String,
    enum: ['course', 'event', 'post', 'booking', 'enrollment', 'comment', 'membership']
  },
  // Notification metadata
  actionUrl: {
    type: String, // Deep link or route path
    trim: true
  },
  icon: {
    type: String, // Icon name or emoji
    default: '🔔'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Status
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },
  // Optional: Schedule notification for later
  scheduledFor: {
    type: Date
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  // Push notification tracking
  pushSent: {
    type: Boolean,
    default: false
  },
  pushSentAt: {
    type: Date
  },
  // Expiry
  expiresAt: {
    type: Date,
    // Auto-delete old notifications after 90 days
    default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete

// Mark as read
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = Date.now();
  return this.save();
};

// Static method to create notification
notificationSchema.statics.createNotification = async function (data) {
  try {
    const notification = new this(data);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Create Notification Error:', error);
    throw error;
  }
};

// Static method to send notification to multiple users
notificationSchema.statics.sendToMultipleUsers = async function (userIds, notificationData) {
  try {
    const notifications = userIds.map(userId => ({
      ...notificationData,
      user: userId
    }));

    const created = await this.insertMany(notifications);
    return created;
  } catch (error) {
    console.error('Send Multiple Notifications Error:', error);
    throw error;
  }
};

const deviceTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android', 'web'],
    default: 'android'
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

deviceTokenSchema.index({ user: 1, token: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);

export default Notification;
