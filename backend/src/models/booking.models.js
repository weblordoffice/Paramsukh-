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
    enum: ['user', 'counselor', 'admin']
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

// Static method to get available slots
bookingSchema.statics.getAvailableSlots = async function (date, counselorType) {
  const bookings = await this.find({
    bookingDate: {
      $gte: new Date(date).setHours(0, 0, 0, 0),
      $lt: new Date(date).setHours(23, 59, 59, 999)
    },
    counselorType,
    status: { $in: ['pending', 'confirmed'] }
  }).select('bookingTime');

  // All possible slots (9 AM to 6 PM)
  const allSlots = [
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
  ];

  const bookedSlots = bookings.map(b => b.bookingTime);
  const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

  return availableSlots;
};

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
