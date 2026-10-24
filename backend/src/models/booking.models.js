import mongoose from 'mongoose';
import CounselorAvailabilityException from './counselorAvailabilityException.model.js';
import {
  startOfUtcDay,
  toDateKey,
  todayInZone,
  zonedDateTimeToUtc,
} from '../utils/timezone.js';

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Service this booking belongs to (resolved at creation)
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CounselingService',
    default: null,
    index: true
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  // Counselor selection
  counselorType: {
    type: String,
    required: true
  },
  counselorName: {
    type: String,
    required: true
  },
  // Booking type/purpose
  bookingType: {
    type: String,
    required: true
  },
  bookingTitle: {
    type: String,
    required: true,
    trim: true
  },
  // Date and time
  bookingDate: {
    type: Date,
    required: true,
    index: true
  },
  bookingTime: {
    type: String, // Format: "10:00 AM" or "14:30"
    required: true
  },
  duration: {
    type: Number, // Duration in minutes
    default: 60
  },
  // User details
  userNotes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  userPhone: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    trim: true
  },
  // Booking status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show', 'waitlisted'],
    default: 'pending'
  },
  // Waitlist for full slots
  waitlistRank: {
    type: Number,
    default: null // null means not on waitlist, number indicates position
  },
  promotedAt: {
    type: Date,
    default: null
  },
  paymentDueAt: {
    type: Date,
    default: null
  },
  // Payment details
  isFree: {
    type: Boolean,
    default: true
  },
  amount: {
    type: Number,
    default: 0
  },
  baseAmount: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
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
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed', 'not_required'],
    default: 'not_required'
  },
  paymentId: {
    type: String
  },
  razorpayOrderId: {
    type: String
  },
  paymentLinkId: {
    type: String
  },
  paymentLinkUrl: {
    type: String
  },
  paymentLinkExpiresAt: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['upi', 'card', 'netbanking', 'wallet', 'cash', 'free', 'razorpay']
  },
  paidAt: {
    type: Date
  },
  // Meeting details
  meetingLink: {
    type: String
  },
  meetingId: {
    type: String
  },
  meetingPassword: {
    type: String
  },
  meetingPlatform: {
    type: String,
    enum: ['zoom', 'google_meet', 'phone', 'in_person'],
    default: 'zoom'
  },
  // Counselor notes (private)
  counselorNotes: {
    type: String,
    trim: true
  },
  // Rescheduling history
  rescheduledFrom: {
    type: Date
  },
  rescheduledReason: {
    type: String
  },
  rescheduledBy: {
    type: String,
    enum: ['user', 'counselor', 'admin']
  },
  // Pending reschedule request (two-way: user→admin or admin→user)
  rescheduleRequest: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'denied'],
      default: 'none'
    },
    requestedBy: {
      type: String,
      enum: ['user', 'admin', 'none'],
      default: 'none'
    },
    requestedNewDate: {
      type: Date
    },
    requestedNewTime: {
      type: String
    },
    reason: {
      type: String,
      trim: true
    },
    respondedAt: {
      type: Date
    },
    responseNote: {
      type: String,
      trim: true
    }
  },
  // Cancellation
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  cancelledBy: {
    type: String,
    enum: ['user', 'counselor', 'admin', 'system']
  },
  // Refund tracking
  refundId: {
    type: String
  },
  refundAmount: {
    type: Number
  },
  refundStatus: {
    type: String,
    enum: ['pending', 'processed', 'failed', 'completed']
  },
  refundError: {
    type: String
  },
  refundProcessedAt: {
    type: Date
  },
  // Completion
  completedAt: {
    type: Date
  },
  // Reminders
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: {
    type: Date
  },
  reminder24SentAt: {
    type: Date,
    default: null
  },
  reminder1SentAt: {
    type: Date,
    default: null
  },
  // Feedback
  userRating: {
    type: Number,
    min: 1,
    max: 5
  },
  userFeedback: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  feedbackSubmittedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
bookingSchema.index({ user: 1, status: 1, bookingDate: -1 });
bookingSchema.index({ counselorType: 1, bookingDate: 1, status: 1 });
bookingSchema.index({ serviceId: 1, bookingDate: 1, status: 1 });
bookingSchema.index({ bookingDate: 1, bookingTime: 1 });

// UNIQUE compound index to prevent double booking (status handled by partialFilterExpression)
bookingSchema.index({ 
  counselorType: 1, 
  bookingDate: 1, 
  bookingTime: 1
}, { 
  unique: true,
  partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } }
});

// Sparse indexes for replay protection lookups
bookingSchema.index({ paymentId: 1 }, { sparse: true, unique: true });
bookingSchema.index({ razorpayOrderId: 1 }, { sparse: true });

// Virtual for formatted date
bookingSchema.virtual('formattedDate').get(function () {
  return this.bookingDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Resolve bookingDate + bookingTime into the exact UTC instant in the service zone
function resolveBookingDateTime(bookingDate, bookingTime, timezone = 'Asia/Kolkata') {
  return zonedDateTimeToUtc(bookingDate, bookingTime, timezone) || new Date(bookingDate);
}

bookingSchema.methods.canBeCancelled = function () {
  if (this.status === 'cancelled' || this.status === 'completed' || this.status === 'no_show') {
    return false;
  }
  const now = new Date();
  const bookingDateTime = resolveBookingDateTime(this.bookingDate, this.bookingTime, this.timezone);
  const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);
  return hoursUntilBooking >= 24;
};

bookingSchema.methods.canBeRescheduled = function () {
  if (this.status === 'cancelled' || this.status === 'completed' || this.status === 'no_show') {
    return false;
  }
  const now = new Date();
  const bookingDateTime = resolveBookingDateTime(this.bookingDate, this.bookingTime, this.timezone);
  const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);
  return hoursUntilBooking >= 48;
};

/**
 * Available slots for a service on a calendar date, in the service's timezone.
 * `date` may be a Date or a YYYY-MM-DD string. Returns "HH:mm" wall-clock slots.
 */
bookingSchema.statics.getAvailableSlots = async function (date, counselorType) {
  const CounselingService = mongoose.model('CounselingService');
  const serviceQuery = mongoose.Types.ObjectId.isValid(String(counselorType))
    ? { _id: counselorType }
    : { title: counselorType };
  const service = await CounselingService.findOne(serviceQuery);

  const dateKey = toDateKey(date);
  if (!service || !service.isActive || !dateKey) {
    return [];
  }

  const timezone = service.timezone || 'Asia/Kolkata';
  const startOfDay = startOfUtcDay(dateKey);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const exception = await CounselorAvailabilityException.findOne({
    serviceId: service._id,
    unavailableDate: { $gte: startOfDay, $lt: endOfDay },
    isActive: true
  });

  if (exception) {
    return [];
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = days[new Date(`${dateKey}T00:00:00Z`).getUTCDay()];
  const hours = service.businessHours?.[dayOfWeek];

  if (!hours || !hours.isActive) {
    return [];
  }

  // Match by serviceId (new bookings) and by title (legacy bookings). Only
  // pending/confirmed bookings hold a slot.
  const bookings = await this.find({
    bookingDate: { $gte: startOfDay, $lt: endOfDay },
    $or: [
      { serviceId: service._id },
      { counselorType: service.title },
      { counselorType: String(counselorType) }
    ],
    status: { $in: ['pending', 'confirmed'] }
  }).select('bookingTime bookingDate');

  const parseTimeToMinutes = (timeStr) => {
    const [hrs, mins] = String(timeStr).split(':').map(Number);
    return hrs * 60 + mins;
  };

  const startMinutes = parseTimeToMinutes(hours.start);
  const endMinutes = parseTimeToMinutes(hours.end);
  const interval = Number(service.intervalMinutes) || 60;
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
    return [];
  }

  const breakStartMinutes = hours.breakStart ? parseTimeToMinutes(hours.breakStart) : null;
  const breakEndMinutes = hours.breakEnd ? parseTimeToMinutes(hours.breakEnd) : null;
  const hasBreak =
    breakStartMinutes != null && breakEndMinutes != null && breakEndMinutes > breakStartMinutes;
  const overlapsBreak = (slotStart) =>
    hasBreak && slotStart < breakEndMinutes && slotStart + interval > breakStartMinutes;

  const bookedSlots = bookings
    .filter((booking) => {
      const slotMinutes = parseTimeToMinutes(booking.bookingTime);
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    })
    .map((booking) => booking.bookingTime);

  const formatMinutesToTime = (totalMinutes) => {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const now = new Date();
  const isToday = dateKey === todayInZone(timezone, now);
  const leadCutoff = new Date(now.getTime() + 30 * 60 * 1000);
  const availableSlots = [];

  for (let current = startMinutes; current + interval <= endMinutes; current += interval) {
    if (overlapsBreak(current)) {
      continue;
    }

    const timeString = formatMinutesToTime(current);
    if (bookedSlots.includes(timeString)) {
      continue;
    }

    if (isToday) {
      const slotInstant = zonedDateTimeToUtc(dateKey, timeString, timezone);
      if (!slotInstant || slotInstant < leadCutoff) {
        continue;
      }
    }

    availableSlots.push(timeString);
  }

  return availableSlots;
};

/** Validate that a wall-clock slot is inside the service's availability grid. */
bookingSchema.statics.isValidSlot = async function (date, counselorType, time) {
  const CounselingService = mongoose.model('CounselingService');
  const serviceQuery = mongoose.Types.ObjectId.isValid(String(counselorType))
    ? { _id: counselorType }
    : { title: counselorType };
  const service = await CounselingService.findOne(serviceQuery);
  const dateKey = toDateKey(date);
  const normalizedTime = String(time || '').trim();
  if (!service || !service.isActive || !dateKey || !/^\d{2}:\d{2}$/.test(normalizedTime)) {
    return false;
  }

  const timezone = service.timezone || 'Asia/Kolkata';
  const startOfDay = startOfUtcDay(dateKey);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const exception = await CounselorAvailabilityException.findOne({
    serviceId: service._id,
    unavailableDate: { $gte: startOfDay, $lt: endOfDay },
    isActive: true,
  });
  if (exception) return false;

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = days[new Date(`${dateKey}T00:00:00Z`).getUTCDay()];
  const hours = service.businessHours?.[dayOfWeek];
  if (!hours || !hours.isActive) return false;

  const parseMinutes = (value) => {
    const [hrs, mins] = String(value).split(':').map(Number);
    return hrs * 60 + mins;
  };
  const slotMinutes = parseMinutes(normalizedTime);
  const startMinutes = parseMinutes(hours.start);
  const endMinutes = parseMinutes(hours.end);
  const interval = Number(service.intervalMinutes) || 60;

  if (!Number.isFinite(slotMinutes) || slotMinutes < startMinutes) return false;
  if (slotMinutes + interval > endMinutes) return false;

  const breakStart = hours.breakStart ? parseMinutes(hours.breakStart) : null;
  const breakEnd = hours.breakEnd ? parseMinutes(hours.breakEnd) : null;
  if (breakStart != null && breakEnd != null && breakEnd > breakStart) {
    if (slotMinutes < breakEnd && slotMinutes + interval > breakStart) return false;
  }

  const slotInstant = zonedDateTimeToUtc(dateKey, normalizedTime, timezone);
  if (!slotInstant || slotInstant < new Date()) return false;

  return true;
};

// Normalize bookingTime and bookingDate on save
bookingSchema.pre('save', function (next) {
  if (this.bookingDate) {
    const normalizedDate = startOfUtcDay(this.bookingDate);
    if (!normalizedDate) {
      return next(new Error('Invalid bookingDate'));
    }
    this.bookingDate = normalizedDate;
  }

  if (!this.timezone) {
    this.timezone = 'Asia/Kolkata';
  }

  if (this.bookingTime) {
    const timeStr = String(this.bookingTime).trim();
    // If already in 24h format (e.g. "14:30"), keep as-is
    if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
      const [h, m] = timeStr.split(':').map(Number);
      this.bookingTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } else {
      // Try to parse 12h format (e.g. "02:30 PM")
      const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const period = match[3].toUpperCase();
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        this.bookingTime = `${String(hours).padStart(2, '0')}:${minutes}`;
      } else {
        return next(new Error(`Invalid bookingTime format: "${timeStr}". Use HH:mm or HH:mm AM/PM.`));
      }
    }
  }
  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
