import mongoose from 'mongoose';

const deviceSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  clerkSessionId: {
    type: String,
    default: null
  },
  authProvider: {
    type: String,
    enum: ['phone', 'google', 'clerk'],
    required: true
  },
  deviceName: {
    type: String,
    required: true
  },
  browser: {
    type: String,
    required: true
  },
  os: {
    type: String,
    required: true
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true
  },
  lastSeen: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to guarantee lookup efficiency of unique active sessions per user/device
deviceSessionSchema.index({ user: 1, deviceId: 1 });

const deviceRegistrationLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true
  },
  registeredAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

export const DeviceSession = mongoose.model('DeviceSession', deviceSessionSchema);
export const DeviceRegistrationLog = mongoose.model('DeviceRegistrationLog', deviceRegistrationLogSchema);
