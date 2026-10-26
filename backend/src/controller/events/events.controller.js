import { Event } from '../../models/event.models.js';
import { EventRegistration } from '../../models/eventRegistration.models.js';
import { escapeRegex } from '../../utils/sanitizeUtils.js';
import { getAdminFromRequest, isValidAdminApiKey } from '../../middleware/adminAuth.js';
import { getScopedIds } from '../../middleware/permissionScope.js';
import { notifyNewEvent } from '../../services/notificationAutomation.service.js';
import { sendNotification } from '../notifications/notifications.controller.js';
import { cancelRegistrationWithSideEffects } from '../../services/eventRegistration.service.js';

const PUBLIC_EVENT_SELECT = '-__v -onlineMeetingLink';
const ALLOWED_CURRENCIES = ['INR', 'USD', 'EUR'];

const shapePublicEvent = (event) => {
  const raw = typeof event?.toObject === 'function' ? event.toObject() : { ...(event || {}) };
  delete raw.onlineMeetingLink;
  const taken = Number(raw.currentAttendees || 0) + Number(raw.reservedSeats || 0);
  return {
    ...raw,
    hasOnlineMeeting: raw.locationType === 'online',
    isFull: raw.maxAttendees != null && taken >= Number(raw.maxAttendees),
    spotsLeft: raw.maxAttendees == null ? null : Math.max(0, Number(raw.maxAttendees) - taken),
  };
};

const validateEventFields = ({
  isPaid,
  price,
  earlyBirdPrice,
  earlyBirdEndDate,
  startTime,
  endTime,
  registrationDeadline,
  maxAttendees,
  currency,
  currentAttendees = 0,
  reservedSeats = 0,
}) => {
  if (currency && !ALLOWED_CURRENCIES.includes(String(currency).toUpperCase())) {
    return `Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`;
  }
  if (Number(price) < 0 || Number(earlyBirdPrice || 0) < 0) {
    return 'Prices cannot be negative';
  }
  if (isPaid && !(Number(price) > 0)) {
    return 'Paid events must have a price greater than 0';
  }
  const start = startTime ? new Date(startTime) : null;
  const end = endTime ? new Date(endTime) : null;
  if (start && end && end <= start) {
    return 'End time must be after start time';
  }
  if (earlyBirdPrice != null && Number(earlyBirdPrice) > 0 && Number(earlyBirdPrice) >= Number(price)) {
    return 'Early bird price must be lower than the regular price';
  }
  if (earlyBirdEndDate && start && new Date(earlyBirdEndDate) > start) {
    return 'Early bird end date must be before the event starts';
  }
  if (registrationDeadline && start && new Date(registrationDeadline) > start) {
    return 'Registration deadline must be before the event starts';
  }
  if (
    maxAttendees != null
    && Number(maxAttendees) < Number(currentAttendees) + Number(reservedSeats)
  ) {
    return 'Capacity cannot be lower than the seats already taken';
  }
  return null;
};

/**
 * Create a new event
 * POST /api/events/create
 */
export const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      shortDescription,
      icon,
      color,
      emoji,
      thumbnailUrl,
      bannerUrl,
      eventDate,
      eventTime,
      startTime,
      endTime,
      timezone,
      location,
      locationType,
      address,
      onlineMeetingLink,
      coordinates,
      category,
      tags,
      isPaid,
      price,
      currency,
      earlyBirdPrice,
      earlyBirdEndDate,
      maxAttendees,
      registrationRequired,
      registrationDeadline,
      organizer,
      requirements,
      whatToBring,
      additionalInfo,
      slug,
      metaTitle,
      metaDescription
    } = req.body;

    // organizerId must come from the authenticated admin, not the request body
    const organizerId = req.admin?._id || req.admin?.id || null;

    const resolvedLocationType = ['physical', 'online'].includes(locationType)
      ? locationType
      : 'physical';
    const trimmedMeetingLink = onlineMeetingLink ? String(onlineMeetingLink).trim() : '';
    const meetingLinkRequired = resolvedLocationType === 'online';

    if (meetingLinkRequired && !trimmedMeetingLink) {
      return res.status(400).json({
        success: false,
        message: "Online meeting link is required for online events"
      });
    }
    if (meetingLinkRequired && !/^https?:\/\//i.test(trimmedMeetingLink)) {
      return res.status(400).json({
        success: false,
        message: "Online meeting link must start with http:// or https://"
      });
    }

    // Location is required except for purely online events (defaulted to "Online").
    const resolvedLocation = String(location || '').trim()
      || (resolvedLocationType === 'online' ? 'Online' : '');

    // Validate required fields
    if (!title || !eventDate || !eventTime || !startTime || !resolvedLocation || !category) {
      return res.status(400).json({
        success: false,
        message: "Required fields: title, eventDate, eventTime, startTime, location, category"
      });
    }

    const semanticError = validateEventFields({
      isPaid,
      price,
      earlyBirdPrice,
      earlyBirdEndDate,
      startTime,
      endTime,
      registrationDeadline,
      maxAttendees,
      currency,
    });
    if (semanticError) {
      return res.status(400).json({ success: false, message: semanticError });
    }

    // Create event
    const event = await Event.create({
      title,
      description,
      shortDescription,
      icon,
      color,
      emoji,
      thumbnailUrl,
      bannerUrl,
      eventDate: new Date(eventDate),
      eventTime,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      timezone,
      location: resolvedLocation,
      locationType: resolvedLocationType,
      address,
      onlineMeetingLink: resolvedLocationType === 'physical' ? null : (trimmedMeetingLink || null),
      coordinates,
      category,
      tags,
      isPaid,
      price,
      currency,
      earlyBirdPrice,
      earlyBirdEndDate: earlyBirdEndDate ? new Date(earlyBirdEndDate) : null,
      maxAttendees,
      registrationRequired,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      organizer,
      organizerId,
      requirements,
      whatToBring,
      additionalInfo,
      slug,
      metaTitle,
      metaDescription
    });

    console.log("✅ Event created:", event.title);

    notifyNewEvent(event).catch((error) =>
      console.error('Event notification failed:', error?.message)
    );

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      event
    });

  } catch (error) {
    console.error("❌ Error creating event:", error);
    
    // Handle duplicate slug error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "An event with this slug already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get all events with optional filters
 * GET /api/events/all
 * Query params: status, category, isPaid, locationType, search, page, limit, sortBy, sortOrder
 */
export const getAllEvents = async (req, res) => {
  try {
    const {
      status,
      category,
      isPaid,
      locationType,
      search,
      upcoming,
      past,
      includeCancelled,
      page = 1,
      limit = 20,
      sortBy = 'eventDate',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    const query = { isActive: true };

    const admin = isValidAdminApiKey(req) ? null : await getAdminFromRequest(req);
    const scopedEventIds = getScopedIds(admin, 'manage_events');
    if (scopedEventIds !== null) {
      query._id = { $in: scopedEventIds };
    }

    // Filter by upcoming/past/status
    const isUpcoming = upcoming === 'true' || status === 'upcoming';
    const isPast = past === 'true' || status === 'past';
    const now = new Date();

    if (isUpcoming) {
      query.status = { $ne: 'cancelled' };
      query.startTime = { $gte: now };
    } else if (isPast) {
      query.status = { $ne: 'cancelled' };
      query.startTime = { $lt: now };
    } else if (status) {
      query.status = status;
    } else if (includeCancelled !== 'true') {
      query.status = { $ne: 'cancelled' };
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by isPaid
    if (isPaid !== undefined) {
      query.isPaid = isPaid === 'true';
    }

    // Filter by location type
    if (locationType) {
      query.locationType = locationType;
    }

    // Text search
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { location: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    // Pagination — validate and sanitize
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Sort — whitelist allowed fields
    const ALLOWED_SORTS = ['eventDate', 'startTime', 'createdAt', 'title', 'price', 'currentAttendees'];
    const sortField = ALLOWED_SORTS.includes(sortBy) ? sortBy : 'eventDate';
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sortOptions = { [sortField]: sortDirection };

    // Execute query
    const [events, totalCount] = await Promise.all([
      Event.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .select(PUBLIC_EVENT_SELECT)
        .lean(),
      Event.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      message: "Events fetched successfully",
      events: events.map(shapePublicEvent),
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalEvents: totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });

  } catch (error) {
    console.error("❌ Error fetching events:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get event by ID
 * GET /api/events/:id
 */
export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required"
      });
    }

    const event = await Event.findById(id).select(PUBLIC_EVENT_SELECT);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    // Get current price (considers early bird pricing)
    const currentPrice = event.getCurrentPrice();
    const canRegister = event.canRegister();

    return res.status(200).json({
      success: true,
      message: "Event fetched successfully",
      event: shapePublicEvent(event),
      meta: {
        currentPrice,
        canRegister,
        isFull: event.isFull(),
        spotsLeft: event.spotsLeft()
      }
    });

  } catch (error) {
    console.error("❌ Error fetching event by ID:", error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get an event by ID for the admin editor (includes the meeting link).
 * GET /api/events/admin/:id
 */
export const getEventByIdAdmin = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select('-__v');
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    return res.status(200).json({
      success: true,
      event,
      meta: {
        currentPrice: event.getCurrentPrice(),
        canRegister: event.canRegister(),
        isFull: event.isFull(),
        spotsLeft: event.spotsLeft(),
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: "Invalid event ID format" });
    }
    console.error("❌ Error fetching event for admin:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Get event by slug
 * GET /api/events/slug/:slug
 */
export const getEventBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Event slug is required"
      });
    }

    const event = await Event.findOne({ slug }).select(PUBLIC_EVENT_SELECT);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    // Get current price (considers early bird pricing)
    const currentPrice = event.getCurrentPrice();
    const canRegister = event.canRegister();

    return res.status(200).json({
      success: true,
      message: "Event fetched successfully",
      event: shapePublicEvent(event),
      meta: {
        currentPrice,
        canRegister,
        isFull: event.isFull(),
        spotsLeft: event.spotsLeft()
      }
    });

  } catch (error) {
    console.error("❌ Error fetching event by slug:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update event
 * PUT /api/events/:id
 */
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required"
      });
    }

    // Whitelist of allowed fields — prevents mass assignment of internal fields
    const ALLOWED_FIELDS = [
      'title', 'description', 'shortDescription', 'icon', 'color', 'emoji',
      'thumbnailUrl', 'bannerUrl',
      'eventDate', 'eventTime', 'startTime', 'endTime', 'timezone',
      'location', 'locationType', 'address', 'onlineMeetingLink', 'coordinates',
      'category', 'tags',
      'isPaid', 'price', 'currency', 'earlyBirdPrice', 'earlyBirdEndDate',
      'maxAttendees', 'registrationRequired', 'registrationDeadline',
      'organizer',
      'requirements', 'whatToBring', 'additionalInfo',
      'slug', 'metaTitle', 'metaDescription',
      'images', 'videos'
    ];

    const updateData = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Convert date strings to Date objects if provided
    if (updateData.eventDate) {
      updateData.eventDate = new Date(updateData.eventDate);
    }
    if (updateData.startTime) {
      updateData.startTime = new Date(updateData.startTime);
    }
    if (updateData.endTime) {
      updateData.endTime = new Date(updateData.endTime);
    }
    if (updateData.earlyBirdEndDate) {
      updateData.earlyBirdEndDate = new Date(updateData.earlyBirdEndDate);
    }
    if (updateData.registrationDeadline) {
      updateData.registrationDeadline = new Date(updateData.registrationDeadline);
    }

    // Use findById + save to trigger pre-save hooks (slug regeneration, status update, imageCount)
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const semanticError = validateEventFields({
      isPaid: updateData.isPaid !== undefined ? updateData.isPaid : event.isPaid,
      price: updateData.price !== undefined ? updateData.price : event.price,
      earlyBirdPrice: updateData.earlyBirdPrice !== undefined ? updateData.earlyBirdPrice : event.earlyBirdPrice,
      earlyBirdEndDate: updateData.earlyBirdEndDate !== undefined ? updateData.earlyBirdEndDate : event.earlyBirdEndDate,
      startTime: updateData.startTime !== undefined ? updateData.startTime : event.startTime,
      endTime: updateData.endTime !== undefined ? updateData.endTime : event.endTime,
      registrationDeadline: updateData.registrationDeadline !== undefined ? updateData.registrationDeadline : event.registrationDeadline,
      maxAttendees: updateData.maxAttendees !== undefined ? updateData.maxAttendees : event.maxAttendees,
      currency: updateData.currency !== undefined ? updateData.currency : event.currency,
      currentAttendees: event.currentAttendees,
      reservedSeats: event.reservedSeats,
    });
    if (semanticError) {
      return res.status(400).json({ success: false, message: semanticError });
    }

    if (updateData.isPaid === false) {
      updateData.price = 0;
      updateData.earlyBirdPrice = 0;
    }

    // Keep the meeting link consistent with the (possibly updated) location type.
    const effectiveLocationType = updateData.locationType ?? event.locationType;
    const meetingLinkRequired = effectiveLocationType === 'online';

    if (meetingLinkRequired) {
      const link = updateData.onlineMeetingLink !== undefined
        ? String(updateData.onlineMeetingLink || '').trim()
        : String(event.onlineMeetingLink || '').trim();

      if (!link) {
        return res.status(400).json({
          success: false,
          message: "Online meeting link is required for online events"
        });
      }
      if (!/^https?:\/\//i.test(link)) {
        return res.status(400).json({
          success: false,
          message: "Online meeting link must start with http:// or https://"
        });
      }
      updateData.onlineMeetingLink = link;

      if (updateData.location !== undefined && !String(updateData.location).trim()) {
        updateData.location = 'Online';
      }
    } else {
      // Physical events must not carry a meeting link.
      updateData.onlineMeetingLink = null;
    }

    Object.assign(event, updateData);
    await event.save();

    console.log("✅ Event updated:", event.title);

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event
    });

  } catch (error) {
    console.error("❌ Error updating event:", error);

    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format"
      });
    }

    // Handle duplicate slug error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "An event with this slug already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Delete event
 * DELETE /api/events/:id
 */
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required"
      });
    }

    const paidRegistrations = await EventRegistration.countDocuments({
      eventId: id,
      paymentStatus: 'completed',
      status: { $ne: 'cancelled' },
    });
    if (paidRegistrations > 0) {
      return res.status(400).json({
        success: false,
        message: "This event has paid registrations. Cancel the event first so refunds can be processed."
      });
    }

    const event = await Event.findByIdAndDelete(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    console.log("✅ Event deleted:", event.title);

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully",
      event
    });

  } catch (error) {
    console.error("❌ Error deleting event:", error);

    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get upcoming events (convenience endpoint)
 * GET /api/events/upcoming
 */
export const getUpcomingEvents = async (req, res) => {
  try {
    const { limit = 10, category } = req.query;

    const query = { 
      isActive: true,
      status: { $ne: 'cancelled' },
      startTime: { $gte: new Date() }
    };

    if (category) {
      query.category = category;
    }

    const events = await Event.find(query)
      .sort({ startTime: 1 })
      .limit(Math.min(100, Math.max(1, parseInt(limit) || 10)))
      .select(PUBLIC_EVENT_SELECT)
      .lean();

    return res.status(200).json({
      success: true,
      message: "Upcoming events fetched successfully",
      events: events.map(shapePublicEvent),
      count: events.length
    });

  } catch (error) {
    console.error("❌ Error fetching upcoming events:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get past events (convenience endpoint)
 * GET /api/events/past
 */
export const getPastEvents = async (req, res) => {
  try {
    const { limit = 10, category, page = 1 } = req.query;

    const query = { 
      isActive: true,
      status: { $ne: 'cancelled' },
      startTime: { $lt: new Date() }
    };

    if (category) {
      query.category = category;
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [events, totalCount] = await Promise.all([
      Event.find(query)
        .sort({ eventDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .select(PUBLIC_EVENT_SELECT)
        .lean(),
      Event.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: "Past events fetched successfully",
      events: events.map(shapePublicEvent),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalEvents: totalCount
      }
    });

  } catch (error) {
    console.error("❌ Error fetching past events:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Cancel event (soft delete)
 * PATCH /api/events/:id/cancel
 */
export const cancelEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required"
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    if (event.status === 'cancelled') {
      return res.status(200).json({
        success: true,
        message: "Event is already cancelled",
        event,
        cancelledCount: 0,
        refundedCount: 0,
        refundFailedCount: 0,
      });
    }

    event.status = 'cancelled';
    await event.save();

    // Cancel pending + confirmed registrations and refund the paid ones.
    // Attended registrations are preserved as attendance history.
    const registrations = await EventRegistration.find({
      eventId: id,
      status: { $in: ['pending', 'confirmed'] },
    });

    let refundedCount = 0;
    let refundFailedCount = 0;

    for (const registration of registrations) {
      try {
        const { refund } = await cancelRegistrationWithSideEffects(registration, {
          cancelledBy: 'admin',
          reason: 'Event cancelled by admin',
          refund: true,
        });

        if (refund?.status === 'processed') refundedCount += 1;
        if (refund?.status === 'failed') refundFailedCount += 1;

        sendNotification(registration.userId, {
          type: 'system',
          title: 'Event Cancelled',
          message: refund?.status === 'processed'
            ? `"${event.title}" was cancelled. Your refund of ₹${Number(registration.refundAmount || 0)} has been processed.`
            : `"${event.title}" was cancelled by the organizer.`,
          icon: '📅',
          relatedId: event._id,
          relatedType: 'event',
          actionUrl: `/event-detail?eventId=${event._id}`,
          priority: 'high',
        }).catch(() => {});
      } catch (registrationError) {
        console.error(`Failed to cancel registration ${registration._id}:`, registrationError.message);
      }
    }

    const currentAttendees = await EventRegistration.countDocuments({
      eventId: id,
      status: { $in: ['confirmed', 'attended'] },
    });
    await Event.findByIdAndUpdate(id, { currentAttendees, reservedSeats: 0 });

    console.log(`✅ Event cancelled: ${event.title} (${registrations.length} registrations cancelled)`);

    return res.status(200).json({
      success: true,
      message: "Event cancelled successfully",
      event,
      cancelledCount: registrations.length,
      refundedCount,
      refundFailedCount,
    });

  } catch (error) {
    console.error("❌ Error cancelling event:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Add images to event
 * POST /api/events/:id/images
 */
export const addEventImages = async (req, res) => {
  try {
    const { id } = req.params;
    const { images } = req.body; // Array of { url, caption }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required"
      });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Images array is required"
      });
    }

    // Validate image URLs
    const URL_REGEX = /^https?:\/\/.+\..+/i;
    const validImages = images.filter(img => img.url && URL_REGEX.test(String(img.url).trim()));
    if (validImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one valid image URL (http/https) is required"
      });
    }

    // Single atomic operation — push images and set imageCount in one call
    const event = await Event.findByIdAndUpdate(
      id,
      {
        $push: {
          images: {
            $each: validImages.map(img => ({
              url: String(img.url).trim(),
              caption: String(img.caption || '').trim(),
              uploadedAt: new Date()
            }))
          }
        },
        $inc: { imageCount: validImages.length }
      },
      { new: true }
    ).select('-__v');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Images added successfully",
      event
    });

  } catch (error) {
    console.error("❌ Error adding images:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Add YouTube video to event
 * POST /api/events/:id/videos
 */
export const addEventVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { url, title, description, thumbnailUrl, type } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required"
      });
    }

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Video URL is required"
      });
    }

    const event = await Event.findByIdAndUpdate(
      id,
      { 
        $push: { 
          videos: {
            type: type || 'youtube',
            url,
            title: title || '',
            description: description || '',
            thumbnailUrl: thumbnailUrl || null,
            addedAt: new Date()
          }
        },
        hasRecording: true
      },
      { new: true }
    ).select('-__v');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Video added successfully",
      event
    });

  } catch (error) {
    console.error("❌ Error adding video:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Delete a single image from an event (by url or _id)
 * DELETE /api/events/:id/images
 */
export const deleteEventImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl, imageId } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Event ID is required" });
    }

    const pullCondition = imageId
      ? { _id: imageId }
      : (imageUrl ? { url: imageUrl } : null);

    if (!pullCondition) {
      return res.status(400).json({ success: false, message: "imageUrl or imageId is required" });
    }

    const event = await Event.findByIdAndUpdate(
      id,
      {
        $pull: { images: pullCondition },
        $inc: { imageCount: -1 }
      },
      { new: true }
    ).select('-__v');

    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    return res.status(200).json({ success: true, message: "Image deleted", event });
  } catch (error) {
    console.error("❌ Error deleting image:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

/**
 * Delete a single video from an event (by url or _id)
 * DELETE /api/events/:id/videos
 */
export const deleteEventVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { videoUrl, videoId } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Event ID is required" });
    }

    const pullCondition = videoId
      ? { _id: videoId }
      : (videoUrl ? { url: videoUrl } : null);

    if (!pullCondition) {
      return res.status(400).json({ success: false, message: "videoUrl or videoId is required" });
    }

    const event = await Event.findByIdAndUpdate(
      id,
      { $pull: { videos: pullCondition } },
      { new: true }
    ).select('-__v');

    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    return res.status(200).json({ success: true, message: "Video deleted", event });
  } catch (error) {
    console.error("❌ Error deleting video:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};


const escapeIcs = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const formatIcsDate = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

/**
 * Download an ICS calendar event for an event.
 * GET /api/events/:id/calendar.ics
 */
export const downloadEventCalendar = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event || event.status === 'cancelled') {
      return res.status(404).send('Event not found');
    }

    const start = new Date(event.startTime || event.eventDate);
    const end = event.endTime
      ? new Date(event.endTime)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const addressText = event.address
      ? [event.address.street, event.address.city, event.address.state, event.address.zipCode, event.address.country]
          .filter(Boolean)
          .join(', ')
      : '';
    const locationText = [event.location, addressText].filter(Boolean).join(' - ');
    const descriptionLines = [
      event.description || event.shortDescription || '',
    ].filter(Boolean).join('\n');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ParamSukh//Events//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event._id}@paramsukh`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(descriptionLines)}`,
      `LOCATION:${escapeIcs(locationText || 'Online')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="event-${event._id}.ics"`);
    return res.status(200).send(ics);
  } catch (error) {
    console.error('Download Event Calendar Error:', error);
    return res.status(500).send('Failed to generate calendar file');
  }
};
