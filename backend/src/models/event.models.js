import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  shortDescription: {
    type: String,
    trim: true
  },
  
  // Visual/UI Properties
  icon: {
    type: String, // Icon name for display (e.g., 'sunny', 'book', 'leaf')
    default: 'calendar'
  }, 
  color: {
    type: String, // Hex color code for UI
    default: '#8B5CF6'
  },
  emoji: {
    type: String, // Emoji for display  
    default: '📅'
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  bannerUrl: {
    type: String,
    default: null
  },
  
  // Event Timing
  eventDate: {
    type: Date,
    required: true,
    index: true
  },
  eventTime: {
    type: String, // e.g., "6:00 AM", "5:00 PM"
    required: true
  },  
  startTime: {
    type: Date, // Full datetime for sorting/filtering
    required: true,
    index: true
  },
  endTime: {
    type: Date,
    default: null
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  
  // Location
  location: {
    type: String,
    required: true,
    trim: true
  },
  locationType: {
    type: String,
    enum: ['physical', 'online', 'hybrid'],
    default: 'physical'
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  onlineMeetingLink: {
    type: String,
    default: null
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  
  // Category & Type
  category: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Pricing
  isPaid: {
    type: Boolean,
    default: false,
    index: true
  },
  price: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  earlyBirdPrice: {
    type: Number,
    default: null
  },
  earlyBirdEndDate: {
    type: Date,
    default: null
  },
  
  // Capacity & Registration
  maxAttendees: {
    type: Number,
    default: null // null means unlimited
  },
  currentAttendees: {
    type: Number,
    default: 0
  },
  registrationRequired: {
    type: Boolean,
    default: false
  },
  registrationDeadline: {
    type: Date,
    default: null
  },
  
  // Status
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'past', 'cancelled'],
    default: 'upcoming',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Organizer
  organizer: {
    type: String,
    default: null
  },
  organizerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Media & Content (for past events)
  recordingUrl: {
    type: String,
    default: null
  },
  hasRecording: {
    type: Boolean,
    default: false
  },
  videos: [{
    type: {
      type: String,
      enum: ['youtube', 'local'],
      default: 'youtube'
    },
    url: {
      type: String,
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    thumbnailUrl: {
      type: String,
      default: null
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  images: [{
    url: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      default: ''
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  imageCount: {
    type: Number,
    default: 0
  },
  
  // Notifications
  notificationEnabled: {
    type: Boolean,
    default: true
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: {
    type: Date,
    default: null
  },
  
  // Additional Information
  requirements: [{
    type: String
  }],
  whatToBring: [{
    type: String
  }],
  additionalInfo: {
    type: String,
    trim: true
  },
  
  // SEO & Metadata
  slug: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  metaTitle: {
    type: String,
    trim: true
  },
  metaDescription: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
eventSchema.index({ title: 'text', description: 'text' });
eventSchema.index({ category: 1 });
eventSchema.index({ status: 1, eventDate: 1 });
eventSchema.index({ isPaid: 1 });
eventSchema.index({ eventDate: 1, startTime: 1 });
eventSchema.index({ createdAt: -1 });
eventSchema.index({ locationType: 1 });
eventSchema.index({ organizerId: 1 });// Pre-save middleware to update status based on eventDate
eventSchema.pre('save', function(next) {
  const now = new Date();
  
  // Update imageCount  
  this.imageCount = this.images.length;
  
  // Generate slug from title if not provided
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  // Auto-update status based on dates (but don't override 'cancelled' status)
  if (this.startTime && this.status !== 'cancelled') {
    if (this.startTime > now) {
      this.status = 'upcoming';
    } else if (this.endTime && this.endTime < now) {
      this.status = 'past';
    } else if (this.startTime <= now && (!this.endTime || this.endTime >= now)) {
      this.status = 'ongoing';
    }
  }
  
  next();
});

// Pre-delete middleware to soft-delete EventRegistrations (preserve payment data)
eventSchema.pre('deleteOne', { document: false, query: true }, async function() {
  try {
    const { EventRegistration } = await import('./eventRegistration.models.js');
    const filter = this.getFilter();
    const eventId = filter._id;
    
    if (eventId) {
      const result = await EventRegistration.updateMany({ eventId }, { status: 'cancelled', notes: 'Event was deleted by Admin' });
      console.log(`✅ Cancelled ${result.modifiedCount} registrations for deleted event: ${eventId}`);
    }
  } catch (error) {
    console.error('❌ Error updating event registrations on cascade delete:', error);
  }
});

// Methods    
eventSchema.methods.isFull = function() {
  return this.maxAttendees !== null && this.currentAttendees >= this.maxAttendees;
};   

eventSchema.methods.canRegister = function() {
  if (!this.isActive || this.status === 'cancelled' || this.status === 'past') {
    return false;
  }    
  
  // Explicitly check if event is in the past
  if (this.startTime && new Date() > this.startTime) {
    return false;
  }
  
  if (this.isFull()) {
    return false;   
  } 
  
  if (this.registrationDeadline && new Date() > this.registrationDeadline) {
    return false;
  }  
  
  return true;
};

eventSchema.methods.getCurrentPrice = function() {
  if (!this.isPaid) return 0;
  
  if (this.earlyBirdPrice && this.earlyBirdEndDate && new Date() <= this.earlyBirdEndDate) {
    return this.earlyBirdPrice;
  }
  
  return this.price;
};

eventSchema.methods.updateAttendeeCount = async function() {
  try {
    // Import EventRegistration dynamically to avoid circular dependency
    const { EventRegistration } = await import('./eventRegistration.models.js');
    const count = await EventRegistration.countDocuments({ 
      eventId: this._id,
      status: 'confirmed'
    });
    this.currentAttendees = count;
    // Note: Don't call this.save() here to avoid triggering pre-save hook again
    // The caller should save the document if needed
    return count;
  } catch (error) {
    // If EventRegistration model doesn't exist yet, return current count
    console.warn('EventRegistration model not found, using currentAttendees field');
    return this.currentAttendees;
  }
};

export const Event = mongoose.model("Event", eventSchema);

