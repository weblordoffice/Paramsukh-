import { Event } from '../../models/event.models.js';

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
      organizerId,
      requirements,
      whatToBring,
      additionalInfo,
      slug,
      metaTitle,
      metaDescription
    } = req.body;

    // Validate required fields
    if (!title || !eventDate || !eventTime || !startTime || !location || !category) {
      return res.status(400).json({
        success: false,
        message: "Required fields: title, eventDate, eventTime, startTime, location, category"
      });
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
      page = 1,
      limit = 20,
      sortBy = 'eventDate',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    const query = { isActive: true };

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
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Sort
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [events, totalCount] = await Promise.all([
      Event.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .select('-__v'),
      Event.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      message: "Events fetched successfully",
      events,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalEvents: totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
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

    const event = await Event.findById(id).select('-__v');

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
      event,
      meta: {
        currentPrice,
        canRegister,
        isFull: event.isFull(),
        spotsLeft: event.maxAttendees ? event.maxAttendees - event.currentAttendees : null
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

    const event = await Event.findOne({ slug }).select('-__v');

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
      event,
      meta: {
        currentPrice,
        canRegister,
        isFull: event.isFull(),
        spotsLeft: event.maxAttendees ? event.maxAttendees - event.currentAttendees : null
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

    // Fields that can be updated
    const updateData = { ...req.body };

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

    const event = await Event.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

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
      .limit(parseInt(limit))
      .select('-__v');

    return res.status(200).json({
      success: true,
      message: "Upcoming events fetched successfully",
      events,
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

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [events, totalCount] = await Promise.all([
      Event.find(query)
        .sort({ eventDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      Event.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: "Past events fetched successfully",
      events,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
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

    const event = await Event.findByIdAndUpdate(
      id,
      { status: 'cancelled' },
      { new: true }
    ).select('-__v');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    console.log("✅ Event cancelled:", event.title);

    return res.status(200).json({
      success: true,
      message: "Event cancelled successfully",
      event
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

    const event = await Event.findByIdAndUpdate(
      id,
      { 
        $push: { 
          images: { 
            $each: images.map(img => ({
              url: img.url,
              caption: img.caption || '',
              uploadedAt: new Date()
            }))
          }
        }
      },
      { new: true }
    ).select('-__v');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    // Update image count
    event.imageCount = event.images.length;
    await event.save();

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

