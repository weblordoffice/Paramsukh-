import { EventRegistration } from '../../models/eventRegistration.models.js';
import { Event } from '../../models/event.models.js';
import { User } from '../../models/user.models.js';
import { createRazorpayOrder, verifyRazorpaySignature, fetchPaymentDetails } from '../../services/razorpayService.js';

/**
 * Register user for an event
 * POST /api/events/:eventId/register
 */
export const registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id; // From auth middleware
    const { notes, name, email, phone, simulatePayment, paymentId } = req.body;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    // Check if user can register
    if (!event.canRegister()) {
      return res.status(400).json({
        success: false,
        message: "Registration is not available for this event",
        reason: event.status === 'cancelled' ? 'Event cancelled' :
                event.status === 'past' ? 'Event has ended' :
                event.isFull() ? 'Event is full' :
                'Registration deadline passed'
      });
    }

    // Check if already registered
    const existingRegistration = await EventRegistration.findOne({
      userId,
      eventId,
      status: { $ne: 'cancelled' }
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: "You are already registered for this event"
      });
    }

    // Get current price
    const currentPrice = event.getCurrentPrice();

    const participantName = name || req.user.displayName || '';
    const participantEmail = email || req.user.email || '';
    const participantPhone = phone || req.user.phone || '';

    const allowSimulatedPayment = process.env.NODE_ENV !== 'production';
    const isSimulatedPayment = Boolean(simulatePayment) && allowSimulatedPayment && currentPrice > 0;
    const finalPaymentStatus = currentPrice > 0
      ? (isSimulatedPayment ? 'completed' : 'pending')
      : 'completed';
    const finalStatus = currentPrice > 0
      ? (isSimulatedPayment ? 'confirmed' : 'pending')
      : 'confirmed';
    const finalPaymentId = isSimulatedPayment ? (paymentId || `sim_${Date.now()}`) : null;
    const paidAt = isSimulatedPayment ? new Date() : null;

    // Create registration
    const registration = await EventRegistration.create({
      userId,
      eventId,
      participantName,
      participantEmail,
      participantPhone,
      notes,
      paymentAmount: currentPrice,
      paymentStatus: finalPaymentStatus,
      paymentId: finalPaymentId,
      paidAt,
      status: finalStatus
    });

    // Update event attendee count
    await event.updateAttendeeCount();
    event.currentAttendees += 1;
    await event.save();

    console.log(`✅ User ${userId} registered for event: ${event.title}`);

    const paymentRequired = currentPrice > 0 && !isSimulatedPayment;
    const responseMessage = paymentRequired
      ? "Registration created. Please complete payment."
      : "Successfully registered for event";

    return res.status(201).json({
      success: true,
      message: responseMessage,
      registration,
      event: {
        _id: event._id,
        title: event.title,
        eventDate: event.eventDate,
        eventTime: event.eventTime,
        location: event.location
      },
      paymentRequired,
      paymentAmount: currentPrice
    });

  } catch (error) {
    console.error("❌ Error registering for event:", error);

    // Handle duplicate registration
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You are already registered for this event"
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
 * Cancel event registration
 * DELETE /api/events/:eventId/register
 */
export const cancelRegistration = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const registration = await EventRegistration.findOne({
      userId,
      eventId,
      status: { $ne: 'cancelled' }
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }

    // Cancel registration
    registration.status = 'cancelled';
    await registration.save();

    // Update event attendee count
    const event = await Event.findById(eventId);
    if (event) {
      event.currentAttendees = Math.max(0, event.currentAttendees - 1);
      await event.save();
    }

    console.log(`✅ Registration cancelled for event: ${eventId}`);

    return res.status(200).json({
      success: true,
      message: "Registration cancelled successfully",
      registration
    });

  } catch (error) {
    console.error("❌ Error cancelling registration:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get user's event registrations
 * GET /api/events/my-registrations
 */
export const getMyRegistrations = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, upcoming, past } = req.query;

    const query = { userId };

    if (status) {
      query.status = status;
    }

    let registrations = await EventRegistration.find(query)
      .populate({
        path: 'eventId',
        select: 'title eventDate eventTime location category emoji color status thumbnailUrl'
      })
      .sort({ registeredAt: -1 });

    // Filter by upcoming/past based on event date
    if (upcoming === 'true') {
      registrations = registrations.filter(r => 
        r.eventId && r.eventId.status === 'upcoming'
      );
    }
    if (past === 'true') {
      registrations = registrations.filter(r => 
        r.eventId && r.eventId.status === 'past'
      );
    }

    return res.status(200).json({
      success: true,
      message: "Registrations fetched successfully",
      registrations,
      count: registrations.length
    });

  } catch (error) {
    console.error("❌ Error fetching registrations:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Check if user is registered for an event
 * GET /api/events/:eventId/registration-status
 */
export const getRegistrationStatus = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const registration = await EventRegistration.findOne({
      userId,
      eventId
    });

    return res.status(200).json({
      success: true,
      isRegistered: !!registration && registration.status !== 'cancelled',
      registration: registration || null
    });

  } catch (error) {
    console.error("❌ Error checking registration status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get all registrations for an event (admin)
 * GET /api/events/:eventId/registrations
 */
export const getEventRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status, page = 1, limit = 50 } = req.query;

    const query = { eventId };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [registrations, totalCount] = await Promise.all([
      EventRegistration.find(query)
        .populate({
          path: 'userId',
          select: 'displayName email phone photoURL'
        })
        .sort({ registeredAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      EventRegistration.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: "Event registrations fetched successfully",
      registrations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalRegistrations: totalCount
      }
    });

  } catch (error) {
    console.error("❌ Error fetching event registrations:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Check-in user at event
 * PATCH /api/events/:eventId/registrations/:registrationId/checkin
 */
export const checkInUser = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;

    const registration = await EventRegistration.findOne({
      _id: registrationId,
      eventId
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }

    if (registration.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: "Cannot check-in. Registration status: " + registration.status
      });
    }

    registration.markAttended();
    await registration.save();

    return res.status(200).json({
      success: true,
      message: "User checked in successfully",
      registration
    });

  } catch (error) {
    console.error("❌ Error checking in user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update payment status after payment completion
 * PATCH /api/events/:eventId/registrations/:registrationId/payment
 */
export const updatePaymentStatus = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const { paymentStatus, paymentId } = req.body;

    const registration = await EventRegistration.findOne({
      _id: registrationId,
      eventId
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }

    registration.paymentStatus = paymentStatus;
    if (paymentId) {
      registration.paymentId = paymentId;
    }
    
    if (paymentStatus === 'completed') {
      registration.paidAt = new Date();
      registration.status = 'confirmed';
    } else if (paymentStatus === 'failed') {
      registration.status = 'cancelled';
    }

    await registration.save();

    return res.status(200).json({
      success: true,
      message: "Payment status updated",
      registration
    });

  } catch (error) {
    console.error("❌ Error updating payment status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Create Razorpay order for paid event registration (books spot + returns order for payment)
 * POST /api/events/:eventId/register/order
 */
export const createEventRegistrationOrder = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    const { name, email, phone, notes } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    if (!event.canRegister()) {
      return res.status(400).json({
        success: false,
        message: "Registration is not available for this event"
      });
    }

    const existing = await EventRegistration.findOne({
      userId,
      eventId,
      status: { $ne: 'cancelled' }
    });
    if (existing && existing.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: "You are already registered for this event"
      });
    }

    const currentPrice = event.getCurrentPrice();
    if (currentPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "This event is free. Use the regular register endpoint."
      });
    }

    const participantName = name || req.user.displayName || '';
    const participantEmail = email || req.user.email || '';
    const participantPhone = phone || req.user.phone || '';

    let registration = existing;
    if (!registration) {
      registration = await EventRegistration.create({
        userId,
        eventId,
        participantName,
        participantEmail,
        participantPhone,
        notes,
        paymentAmount: currentPrice,
        paymentStatus: 'pending',
        status: 'pending'
      });
    } else {
      registration.participantName = participantName;
      registration.participantEmail = participantEmail;
      registration.participantPhone = participantPhone;
      if (notes !== undefined) registration.notes = notes;
      registration.paymentAmount = currentPrice;
      await registration.save();
    }

    const order = await createRazorpayOrder({
      amount: currentPrice,
      currency: (event.currency || 'INR').toUpperCase(),
      receipt: `event_${eventId}_${registration._id}_${Date.now()}`,
      notes: {
        type: 'event',
        eventId: eventId.toString(),
        registrationId: registration._id.toString(),
        userId: userId.toString()
      }
    });

    return res.status(200).json({
      success: true,
      message: "Order created. Complete payment to confirm your registration.",
      data: {
        registrationId: registration._id.toString(),
        razorpay: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo'
        }
      }
    });
  } catch (error) {
    console.error("❌ Create event order error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create order"
    });
  }
};

/**
 * Confirm event payment after Razorpay success (confirm registration + add to user purchases)
 * POST /api/events/:eventId/register/confirm
 */
export const confirmEventPayment = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: "Missing payment details"
      });
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature || 'test_signature'
    );
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature"
      });
    }

    const registration = await EventRegistration.findOne({
      userId,
      eventId,
      status: 'pending'
    });
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "No pending registration found. Please register and pay again."
      });
    }

    let paymentDetails;
    try {
      paymentDetails = await fetchPaymentDetails(razorpay_payment_id);
    } catch (e) {
      paymentDetails = { amount: registration.paymentAmount * 100, status: 'captured' };
    }

    registration.paymentStatus = 'completed';
    registration.paymentId = razorpay_payment_id;
    registration.paidAt = new Date();
    registration.status = 'confirmed';
    await registration.save();

    const event = await Event.findById(eventId).select('title');
    const amountInRupees = (paymentDetails.amount && typeof paymentDetails.amount === 'number')
      ? paymentDetails.amount / 100
      : registration.paymentAmount;

    const user = await User.findById(userId).select('payments');
    if (user) {
      user.payments = user.payments || [];
      user.payments.push({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: amountInRupees,
        plan: `Event - ${event?.title || 'Event'}`,
        status: 'completed',
        date: new Date()
      });
      await user.save();
    }

    const EventModel = await Event.findById(eventId);
    if (EventModel && typeof EventModel.updateAttendeeCount === 'function') {
      await EventModel.updateAttendeeCount();
      await EventModel.save();
    }

    return res.status(200).json({
      success: true,
      message: "Payment confirmed. You are registered for this event.",
      registration: {
        _id: registration._id,
        status: registration.status,
        paymentStatus: registration.paymentStatus
      }
    });
  } catch (error) {
    console.error("❌ Confirm event payment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to confirm payment"
    });
  }
};

