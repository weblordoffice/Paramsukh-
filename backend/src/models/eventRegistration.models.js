import mongoose from "mongoose";

const eventRegistrationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  ticketId: {
    type: String,
    sparse: true,
    unique: true
  },
  
  // Registration status
  registeredAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'attended', 'no-show'],
    default: 'confirmed',
    index: true
  },
  
  // Payment information (for paid events)
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentAmount: {
    type: Number,
    default: 0
  },
  paymentId: {
    type: String,
    default: null
  },
  paidAt: {
    type: Date,
    default: null
  },
  
  // Additional registration data
  participantName: {
    type: String,
    trim: true,
    default: null
  },
  participantEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  participantPhone: {
    type: String,
    trim: true,
    default: null
  },
  notes: {
    type: String,
    trim: true
  },
  checkedIn: {
    type: Boolean,
    default: false
  },
  checkedInAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index to ensure one registration per user per event
eventRegistrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });
eventRegistrationSchema.index({ eventId: 1, status: 1 });
eventRegistrationSchema.index({ userId: 1, status: 1 });
eventRegistrationSchema.index({ registeredAt: -1 });
eventRegistrationSchema.index({ ticketId: 1 });

eventRegistrationSchema.pre('save', function(next) {
  if (this.status === 'confirmed' && !this.ticketId) {
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const timestampStr = Date.now().toString().slice(-4);
    this.ticketId = `EVT-${randomStr}-${timestampStr}`;
  }
  next();
});

// Methods
eventRegistrationSchema.methods.markAttended = function() {
  this.status = 'attended';
  this.checkedIn = true;
  this.checkedInAt = new Date();
  return this;
};

eventRegistrationSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this;
};

export const EventRegistration = mongoose.model("EventRegistration", eventRegistrationSchema);
