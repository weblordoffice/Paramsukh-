import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
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
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show'],
    default: 'pending',
    index: true
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
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed', 'not_required'],
    default: 'not_required'
  },
  paymentId: {
    type: String
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
  // Feedback
  userRating: {
    type: Number,
    min: 1,
    max: 5
  },
  userFeedback: {
    type: String,
    trim: true
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
bookingSchema.index({ bookingDate: 1, bookingTime: 1 });

// UNIQUE compound index to prevent double booking (race condition prevention)
bookingSchema.index({ 
  counselorType: 1, 
  bookingDate: 1, 
  bookingTime: 1, 
  status: 1 
}, { 
  unique: true,
  partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } }
});

// Virtual for formatted date
bookingSchema.virtual('formattedDate').get(function () {
  return this.bookingDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Method to check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function () {
  if (this.status === 'cancelled' || this.status === 'completed') {
    return false;
  }

  // Check if booking is at least 24 hours away
  const now = new Date();
  const bookingDateTime = new Date(this.bookingDate);
  const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);

  return hoursUntilBooking >= 24;
};

// Method to check if booking can be rescheduled
bookingSchema.methods.canBeRescheduled = function () {
  if (this.status === 'cancelled' || this.status === 'completed') {
    return false;
  }

  // Check if booking is at least 48 hours away
  const now = new Date();
  const bookingDateTime = new Date(this.bookingDate);
  const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);

  return hoursUntilBooking >= 48;
};

// Static method to get available slots (TIMEZONE FIX: Use UTC consistently)
bookingSchema.statics.getAvailableSlots = async function (date, counselorType) {
  const CounselingService = mongoose.model('CounselingService');
  const service = await CounselingService.findOne({ title: counselorType });

  if (!service || !service.isActive) {
    return [];
  }

  // TIMEZONE FIX: Parse date as UTC to avoid server timezone issues
  const queryDate = new Date(date);
  const startOfDay = new Date(Date.UTC(
    queryDate.getUTCFullYear(),
    queryDate.getUTCMonth(),
    queryDate.getUTCDate(),
    0, 0, 0, 0
  ));
  const endOfDay = new Date(Date.UTC(
    queryDate.getUTCFullYear(),
    queryDate.getUTCMonth(),
    queryDate.getUTCDate(),
    23, 59, 59, 999
  ));

  // DYNAMIC AVAILABILITY: Check for exceptions (holidays, sick leave, etc.)
  try {
    const CounselorAvailabilityException = mongoose.model('CounselorAvailabilityException');
    const exception = await CounselorAvailabilityException.findOne({
      serviceId: service._id,
      unavailableDate: { $gte: startOfDay, $lt: endOfDay },
      isActive: true
    });

    if (exception) {
      console.log(`🚫 Service ${counselorType} unavailable on ${date}: ${exception.reason}`);
      return []; // No slots available on this date
    }
  } catch (error) {
    // Model might not exist yet, continue without exception check
    console.log('⚠️ CounselorAvailabilityException model not found, skipping exception check');
  }

  // Determine day of week in UTC
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = days[queryDate.getUTCDay()];
  const hours = service.businessHours[dayOfWeek];

  if (!hours || !hours.isActive) {
    return [];
  }

  const bookings = await this.find({
    bookingDate: {
      $gte: startOfDay,
      $lt: endOfDay
    },
    counselorType,
    status: { $in: ['pending', 'confirmed'] }
  }).select('bookingTime');

  const bookedSlots = bookings.map(b => b.bookingTime);

  // Helper to parse "HH:mm" to minutes from midnight
  const parseTimeToMinutes = (timeStr) => {
    const [hrs, mins] = timeStr.split(':').map(Number);
    return hrs * 60 + mins;
  };

  // Helper to format minutes to "hh:mm AM/PM"
  const formatMinutesToTime = (totalMinutes) => {
    let hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const displayHrs = hrs % 12 || 12;
    return `${displayHrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`;
  };

  const startMinutes = parseTimeToMinutes(hours.start);
  const endMinutes = parseTimeToMinutes(hours.end);
  const interval = service.intervalMinutes || 60;

  const availableSlots = [];
  
  // TIMEZONE FIX: Use UTC for current time check
  const now = new Date();
  const isToday = now.toISOString().split('T')[0] === queryDate.toISOString().split('T')[0];
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  for (let current = startMinutes; current + interval <= endMinutes; current += interval) {
    // If it's today, only show future slots (add 30 min buffer)
    if (isToday && current < currentMinutes + 30) {
      continue;
    }

    const timeString = formatMinutesToTime(current);
    if (!bookedSlots.includes(timeString)) {
      availableSlots.push(timeString);
    }
  }

  return availableSlots;
};

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
