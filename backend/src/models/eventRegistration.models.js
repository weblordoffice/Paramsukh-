import mongoose from "mongoose";
import crypto from "crypto";

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
  // True while this registration holds one seat in Event.reservedSeats.
  seatReserved: {
    type: Boolean,
    default: false,
    index: true
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
    default: 0,
    min: 0
  },
  baseAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  couponCode: {
    type: String,
    default: null,
    trim: true
  },
  offerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    default: null
  },
  offerTitle: {
    type: String,
    default: null,
    trim: true
  },
  paymentId: {
    type: String,
    default: null
  },
  razorpayOrderId: {
    type: String,
    default: null
  },
  paymentLinkId: {
    type: String,
    default: null
  },
  paymentLinkUrl: {
    type: String,
    default: null
  },
  paymentLinkExpiresAt: {
    type: Date,
    default: null
  },
  paymentLinkAmount: {
    type: Number,
    default: null,
    min: 0
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
  },
  // Cancellation
  cancelledAt: {
    type: Date,
    default: null
  },
  cancelledBy: {
    type: String,
    enum: ['user', 'admin', 'system', null],
    default: null
  },
  cancellationReason: {
    type: String,
    trim: true,
    default: null
  },
  // Refunds
  refundId: {
    type: String,
    default: null
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  refundStatus: {
    type: String,
    enum: ['pending', 'processed', 'failed', null],
    default: null
  },
  refundProcessedAt: {
    type: Date,
    default: null
  },
  refundError: {
    type: String,
    default: null
  },
  // Reminder tracking (set by the event reminder cron)
  reminder24SentAt: {
    type: Date,
    default: null
  },
  reminder1SentAt: {
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
eventRegistrationSchema.index({ status: 1, updatedAt: 1 });

const generateTicketId = () => {
  const unique = crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, 8);
  return `EVT-${unique}`;
};

eventRegistrationSchema.statics.generateTicketId = generateTicketId;

/**
 * Generate a ticket id for registrations confirmed through an atomic
 * findOneAndUpdate (webhook / payment-link paths) where pre('save') never runs.
 */
eventRegistrationSchema.statics.ensureTicketId = async function(registration) {
  if (!registration || registration.ticketId || registration.status !== 'confirmed') {
    return registration;
  }
  const ticketId = generateTicketId();
  const updated = await this.findOneAndUpdate(
    { _id: registration._id, ticketId: null },
    { $set: { ticketId } },
    { new: true }
  );
  if (updated) {
    registration.ticketId = updated.ticketId;
    return updated;
  }
  return registration;
};

eventRegistrationSchema.pre('save', function(next) {
  if (this.status === 'confirmed' && !this.ticketId) {
    this.ticketId = generateTicketId();
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
