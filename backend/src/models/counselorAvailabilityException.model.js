import mongoose from 'mongoose';

/**
 * Counselor Availability Exception Model
 * Allows counselors to mark specific dates as unavailable (holidays, sick leave, etc.)
 */
const counselorAvailabilityExceptionSchema = new mongoose.Schema({
  // Service this exception applies to
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CounselingService',
    required: true,
    index: true
  },
  
  // Date that is unavailable
  unavailableDate: {
    type: Date,
    required: true,
    index: true
  },
  
  // Reason for unavailability
  reason: {
    type: String,
    required: true,
    enum: ['holiday', 'sick_leave', 'personal', 'training', 'other'],
    default: 'other'
  },
  
  // Additional notes
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Who created this exception
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Whether this exception is active
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate exceptions
counselorAvailabilityExceptionSchema.index(
  { serviceId: 1, unavailableDate: 1 },
  { unique: true }
);

// Index for efficient queries
counselorAvailabilityExceptionSchema.index({ unavailableDate: 1, isActive: 1 });

const CounselorAvailabilityException = mongoose.model(
  'CounselorAvailabilityException',
  counselorAvailabilityExceptionSchema
);

export default CounselorAvailabilityException;
