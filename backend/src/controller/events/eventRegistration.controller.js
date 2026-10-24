import { EventRegistration } from '../../models/eventRegistration.models.js';
import { Event } from '../../models/event.models.js';
import { User } from '../../models/user.models.js';
import { createRazorpayOrder, createRazorpayPaymentLink, verifyRazorpaySignature, fetchPaymentDetails, fetchPaymentLink, isRazorpayTestMode } from '../../services/razorpayService.js';
import { sendNotification } from '../notifications/notifications.controller.js';
import { recordTransaction } from '../../services/transaction.service.js';
import { sendEventRegistrationEmail } from '../../services/emailService.js';
import {
  applyPurchaseDiscount,
  createPurchaseDiscount,
  resolvePurchaseDiscount,
} from '../../services/purchaseDiscount.service.js';
import {
  cancelRegistrationWithSideEffects,
  ensureTicketId,
  refundEventRegistration,
  releaseSeat,
  reserveSeat,
  revertDiscountForRegistration,
} from '../../services/eventRegistration.service.js';

const evaluateEventAchievements = async (userId) => {
  try {
    const { unlockBadgesForUser } = await import('../../services/badgeUnlockingService.js');
    await unlockBadgesForUser(userId);
  } catch (error) {
    console.error('Event badge evaluation failed:', error?.message);
  }
};

const syncEventAttendeeCount = async (eventOrId) => {
  const event = typeof eventOrId?.updateAttendeeCount === 'function'
    ? eventOrId
    : await Event.findById(eventOrId);

  if (!event) {
    return null;
  }

  await event.updateAttendeeCount();
  await event.save();
  return event;
};

const buildEventSummary = (event) => ({
  _id: event?._id,
  title: event?.title,
  eventDate: event?.eventDate,
  eventTime: event?.eventTime,
  location: event?.location,
});

const applyRegistrationState = ({
  registration,
  currentPrice,
  participantName,
  participantEmail,
  participantPhone,
  notes,
  isSimulatedPayment = false,
  paymentId = null,
}) => {
  const paid = currentPrice > 0;
  const paymentComplete = paid ? Boolean(isSimulatedPayment) : true;

  registration.participantName = participantName;
  registration.participantEmail = participantEmail;
  registration.participantPhone = participantPhone;
  if (notes !== undefined) {
    registration.notes = notes;
  }
  registration.paymentAmount = currentPrice;
  registration.checkedIn = false;
  registration.checkedInAt = null;
  registration.status = paymentComplete ? 'confirmed' : 'pending';
  registration.paymentStatus = paymentComplete ? 'completed' : (paid ? 'pending' : 'completed');
  registration.paymentId = paymentComplete ? (paymentId || registration.paymentId || null) : null;
  registration.paidAt = paymentComplete ? new Date() : null;

  return registration;
};

/**
 * Register user for an event
 * POST /api/events/:eventId/register
 */
export const registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id; // From auth middleware
    const { notes, name, email, phone, simulatePayment, paymentId } = req.body || {};

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

    // Check existing registration history for this user + event.
    const existingRegistration = await EventRegistration.findOne({ userId, eventId });

    // Get current price
    const currentPrice = event.getCurrentPrice();

    const participantName = name || req.user.displayName || '';
    const participantEmail = email || req.user.email || '';
    const participantPhone = phone || req.user.phone || '';

    const allowSimulatedPayment = process.env.NODE_ENV !== 'production';
    const isSimulatedPayment = Boolean(simulatePayment) && allowSimulatedPayment && currentPrice > 0;
    const finalPaymentId = isSimulatedPayment ? (paymentId || `sim_${Date.now()}`) : null;
    const paidAt = isSimulatedPayment ? new Date() : null;

    if (currentPrice > 0 && !isSimulatedPayment) {
      return res.status(400).json({
        success: false,
        message: "This is a paid event. Use the payment order or payment link flow to register."
      });
    }

    let registration = existingRegistration;

    if (registration && ['confirmed', 'attended'].includes(registration.status)) {
      await syncEventAttendeeCount(event);
      return res.status(200).json({
        success: true,
        message: currentPrice > 0 && registration.paymentStatus !== 'completed'
          ? "Your registration already exists and payment is still pending."
          : "You are already registered for this event",
        registration,
        event: buildEventSummary(event),
        paymentRequired: currentPrice > 0 && registration.paymentStatus !== 'completed',
        paymentAmount: currentPrice
      });
    }

    if (!registration) {
      registration = new EventRegistration({ userId, eventId });
    }

    const isNewRegistration = !existingRegistration;

    applyRegistrationState({
      registration,
      currentPrice,
      participantName,
      participantEmail,
      participantPhone,
      notes,
      isSimulatedPayment,
      paymentId: finalPaymentId,
    });
    registration.paidAt = paidAt;

    await registration.save();

    // Reserve a seat for capacity-limited events (including free) to prevent overselling
    const needsSeatCheck = event.maxAttendees != null && !isSimulatedPayment;
    if (needsSeatCheck) {
      const reserved = await reserveSeat(eventId, registration);
      if (!reserved) {
        if (isNewRegistration) {
          await EventRegistration.findByIdAndDelete(registration._id);
        } else {
          registration.status = 'cancelled';
          registration.cancellationReason = 'Event is full';
          registration.cancelledBy = 'system';
          registration.cancelledAt = new Date();
          await registration.save();
        }
        return res.status(400).json({
          success: false,
          message: "This event is full. No seats available."
        });
      }
    }

    await syncEventAttendeeCount(event);

    // Release the reserved seat — currentAttendees is now set by the count of confirmed registrations
    if (needsSeatCheck) {
      await releaseSeat(registration);
    }

    console.log(`✅ User ${userId} registered for event: ${event.title}`);

    const paymentRequired = currentPrice > 0 && !isSimulatedPayment;
    const responseMessage = paymentRequired
      ? "Registration created. Please complete payment."
      : "Successfully registered for event";

    // Send in-app + push notification for confirmed free registrations
    if (!paymentRequired) {
      sendNotification(userId, {
        type: 'event_registered',
        title: '🎉 Event Registration Confirmed',
        message: `You're registered for "${event.title}" on ${new Date(event.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
        icon: event.emoji || '📅',
        relatedId: event._id,
        relatedType: 'event',
        actionUrl: `/event-detail?eventId=${event._id}`,
        priority: 'high',
      }).catch(() => {});
    }

    // Referral: reward the referrer when their referred user registers
    if (!paymentRequired && req.user?.referredBy) {
      const { fireTrigger } = await import('../../services/referral.service.js');
      fireTrigger('user.event_register', { referrerId: req.user.referredBy, referredUserId: userId }).catch(() => {});
    }

    if (!paymentRequired) {
      await evaluateEventAchievements(userId);
    }

    return res.status(201).json({
      success: true,
      message: responseMessage,
      registration,
      event: buildEventSummary(event),
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

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const registration = await EventRegistration.findOne({ userId, eventId });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }

    if (registration.status === 'cancelled') {
      await syncEventAttendeeCount(eventId);
      return res.status(200).json({
        success: true,
        message: "Registration is already cancelled",
        registration,
        refundStatus: registration.refundStatus || null
      });
    }

    if (registration.status === 'attended' || registration.checkedIn) {
      return res.status(400).json({
        success: false,
        message: "Attended registrations cannot be cancelled"
      });
    }

    if (event.startTime && new Date() >= new Date(event.startTime)) {
      return res.status(400).json({
        success: false,
        message: "Cancellation is closed because the event has started"
      });
    }

    const { refund } = await cancelRegistrationWithSideEffects(registration, {
      cancelledBy: 'user',
      reason: 'Cancelled by user',
      refund: true,
    });

    await syncEventAttendeeCount(eventId);

    const refundStatus = refund?.status || registration.refundStatus || null;
    const refundMessage = refundStatus === 'processed'
      ? ` A refund of ₹${Number(registration.refundAmount || registration.paymentAmount || 0)} has been initiated.`
      : refundStatus === 'failed'
        ? ' The refund could not be processed automatically; support will follow up.'
        : '';

    sendNotification(userId, {
      type: 'system',
      title: 'Registration Cancelled',
      message: `Your registration for "${event.title}" was cancelled.${refundMessage}`,
      icon: '🎟️',
      relatedId: event._id,
      relatedType: 'event',
      actionUrl: `/event-detail?eventId=${event._id}`,
      priority: 'medium',
    }).catch(() => {});

    console.log(`✅ Registration cancelled for event: ${eventId}`);

    return res.status(200).json({
      success: true,
      message: `Registration cancelled successfully.${refundMessage}`,
      registration,
      refundStatus
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
 * Cancel a registration as an admin (refunds paid registrations).
 * DELETE /api/events/:eventId/registrations/:registrationId
 */
export const cancelRegistrationAdmin = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const force = req.body?.force === true || String(req.body?.force) === 'true';

    const registration = await EventRegistration.findOne({ _id: registrationId, eventId });
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }

    if (registration.status === 'cancelled') {
      await syncEventAttendeeCount(eventId);
      return res.status(200).json({
        success: true,
        message: "Registration is already cancelled",
        registration,
      });
    }

    if ((registration.status === 'attended' || registration.checkedIn) && !force) {
      return res.status(400).json({
        success: false,
        message: "Attended registrations require force=true to cancel",
      });
    }

    const { refund } = await cancelRegistrationWithSideEffects(registration, {
      cancelledBy: 'admin',
      reason: req.body?.reason || 'Cancelled by admin',
      refund: true,
    });

    await syncEventAttendeeCount(eventId);

    sendNotification(registration.userId, {
      type: 'system',
      title: 'Registration Cancelled',
      message: refund?.status === 'processed'
        ? `An admin cancelled your registration and refunded ₹${Number(registration.refundAmount || 0)}.`
        : 'An admin cancelled your event registration.',
      icon: '🎟️',
      relatedId: eventId,
      relatedType: 'event',
      actionUrl: `/event-detail?eventId=${eventId}`,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: refund?.status === 'failed'
        ? 'Registration cancelled, but the refund failed and needs a retry'
        : 'Registration cancelled',
      registration,
      refundStatus: refund?.status || registration.refundStatus || null,
    });
  } catch (error) {
    console.error("❌ Admin cancel registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Refund a paid registration (admin).
 * POST /api/events/:eventId/registrations/:registrationId/refund
 */
export const refundRegistrationAdmin = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;

    const registration = await EventRegistration.findOne({ _id: registrationId, eventId });
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }

    if (registration.refundStatus === 'processed') {
      return res.status(200).json({
        success: true,
        message: "Registration is already refunded",
        registration,
      });
    }

    if (registration.paymentStatus !== 'completed' || !registration.paymentId) {
      return res.status(400).json({
        success: false,
        message: "Only paid registrations can be refunded",
      });
    }

    const result = await refundEventRegistration(registration, {
      reason: req.body?.reason || 'Refunded by admin',
    });

    if (result.status === 'failed') {
      await registration.save();
      return res.status(502).json({
        success: false,
        message: "Refund failed",
        error: result.error,
        registration,
      });
    }

    if (registration.status !== 'cancelled') {
      await releaseSeat(registration);
      registration.status = 'cancelled';
      registration.cancelledAt = new Date();
      registration.cancelledBy = 'admin';
      registration.cancellationReason = req.body?.reason || 'Refunded by admin';
      await revertDiscountForRegistration(registration);
      await registration.save();
    }

    await syncEventAttendeeCount(eventId);

    sendNotification(registration.userId, {
      type: 'system',
      title: 'Refund Processed',
      message: `Your refund of ₹${Number(registration.refundAmount || 0)} has been processed.`,
      icon: '💰',
      relatedId: eventId,
      relatedType: 'event',
      actionUrl: `/event-detail?eventId=${eventId}`,
      priority: 'high',
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Refund processed",
      registration,
      refundStatus: registration.refundStatus,
    });
  } catch (error) {
    console.error("❌ Admin refund error:", error);
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
    } else {
      query.status = { $ne: 'cancelled' };
    }

    let registrations = await EventRegistration.find(query)
      .populate({
        path: 'eventId',
        select: 'title eventDate eventTime startTime location category emoji color status thumbnailUrl'
      })
      .sort({ registeredAt: -1 });

    // Filter by upcoming/past based on startTime
    const now = new Date();
    if (upcoming === 'true') {
      registrations = registrations.filter(r => 
        r.eventId && r.eventId.status !== 'cancelled' && new Date(r.eventId.startTime) >= now
      );
    }
    if (past === 'true') {
      registrations = registrations.filter(r => 
        r.eventId && r.eventId.status !== 'cancelled' && new Date(r.eventId.startTime) < now
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
 * Get the online meeting link for a confirmed/paid registration.
 * GET /api/events/:eventId/meeting-link
 */
export const getMeetingLink = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const event = await Event.findById(eventId).select('onlineMeetingLink locationType isPaid title');
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    if (!event.onlineMeetingLink) {
      return res.status(404).json({ success: false, message: "This event has no online meeting link" });
    }

    const registration = await EventRegistration.findOne({ userId, eventId });
    const hasAccess = Boolean(
      registration
      && ['confirmed', 'attended'].includes(registration.status)
      && (!event.isPaid || registration.paymentStatus === 'completed')
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "A confirmed registration and completed payment are required to access this link"
      });
    }

    return res.status(200).json({
      success: true,
      url: event.onlineMeetingLink
    });
  } catch (error) {
    console.error("❌ Error fetching event meeting link:", error);
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

    if (!['confirmed', 'attended', 'no-show'].includes(registration.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot check-in. Registration status: " + registration.status
      });
    }

    const requestedStatus = req.body?.status === 'no-show' ? 'no-show' : 'attended';
    if (requestedStatus === 'no-show') {
      registration.status = 'no-show';
      registration.checkedIn = false;
      registration.checkedInAt = null;
    } else {
      registration.markAttended();
    }
    await registration.save();
    await syncEventAttendeeCount(eventId);

    return res.status(200).json({
      success: true,
      message: requestedStatus === 'no-show' ? "Registration marked as no-show" : "User checked in successfully",
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

    const VALID_STATUSES = ['pending', 'completed', 'failed', 'refunded'];
    if (!VALID_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid paymentStatus. Must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

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

    if (paymentStatus === 'completed') {
      if (paymentId) {
        registration.paymentId = paymentId;
      }
      registration.paymentStatus = 'completed';
      registration.status = 'confirmed';
      registration.paidAt = new Date();
      await registration.save();

      await ensureTicketId(registration);
      await releaseSeat(registration);
      await applyPurchaseDiscount({
        providerOrderId: registration.razorpayOrderId || null,
        providerPaymentLinkId: registration.paymentLinkId || null,
        referenceType: 'event',
        referenceId: registration._id,
      });
    } else if (paymentStatus === 'failed') {
      await cancelRegistrationWithSideEffects(registration, {
        cancelledBy: 'admin',
        reason: req.body.reason || 'Marked failed by admin',
        refund: false,
      });
    } else if (paymentStatus === 'refunded') {
      const { refund } = await cancelRegistrationWithSideEffects(registration, {
        cancelledBy: 'admin',
        reason: req.body.reason || 'Refunded by admin',
        refund: true,
      });
      if (refund?.status === 'failed') {
        return res.status(502).json({
          success: false,
          message: 'Refund failed. Registration was cancelled and the refund is marked for retry.',
          error: refund.error,
          registration,
        });
      }
    } else {
      registration.paymentStatus = 'pending';
      await registration.save();
    }

    await syncEventAttendeeCount(eventId);

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
    const { name, email, phone, notes, couponCode } = req.body;

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

    const existing = await EventRegistration.findOne({ userId, eventId });
    if (existing && ['confirmed', 'attended'].includes(existing.status)) {
      return res.status(400).json({
        success: false,
        message: "You are already registered for this event"
      });
    }

    const basePrice = event.getCurrentPrice();
    if (basePrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "This event is free. Use the regular register endpoint."
      });
    }

    const discount = await resolvePurchaseDiscount({
      userId,
      purchaseType: 'event',
      targetId: event._id,
      amount: basePrice,
      couponCode,
    });
    if (discount.error) {
      return res.status(400).json({ success: false, message: discount.error });
    }
    const currentPrice = Number(discount.finalAmount || 0);
    if (currentPrice <= 0) {
      return res.status(400).json({ success: false, message: 'This discount makes the event free. Please contact support.' });
    }

    const participantName = name || req.user.displayName || '';
    const participantEmail = email || req.user.email || '';
    const participantPhone = phone || req.user.phone || '';

    let registration = existing;
    const isNewRegistration = !registration;
    if (!registration) {
      registration = new EventRegistration({ userId, eventId });
    }
    applyRegistrationState({
      registration,
      currentPrice,
      participantName,
      participantEmail,
      participantPhone,
      notes,
      isSimulatedPayment: false,
    });
    registration.baseAmount = discount.baseAmount;
    registration.discountAmount = discount.discountAmount;
    registration.couponCode = discount.couponCode;
    registration.offerId = discount.offer?._id || null;
    registration.offerTitle = discount.offerTitle;
    registration.status = 'pending';
    registration.paymentStatus = 'pending';
    registration.paymentId = null;
    registration.paidAt = null;
    await registration.save();

    // Reserve a seat for paid registrations to prevent overselling
    if (!registration.seatReserved) {
      const reservedEvent = await reserveSeat(eventId, registration);
      if (!reservedEvent) {
        if (isNewRegistration) {
          await EventRegistration.findByIdAndDelete(registration._id);
        } else {
          await cancelRegistrationWithSideEffects(registration, {
            cancelledBy: 'system',
            reason: 'Event is full',
            refund: false,
          });
        }
        return res.status(400).json({
          success: false,
          message: "This event is full. No seats available."
        });
      }
    }

    let order;
    try {
      order = await createRazorpayOrder({
        amount: currentPrice,
        currency: (event.currency || 'INR').toUpperCase(),
        receipt: `event_${String(registration._id).slice(-6)}_${Date.now().toString(36)}`,
        notes: {
          type: 'event',
          eventId: eventId.toString(),
          registrationId: registration._id.toString(),
          userId: userId.toString(),
          baseAmount: String(discount.baseAmount),
          discountAmount: String(discount.discountAmount),
          finalAmount: String(discount.finalAmount),
          couponCode: discount.couponCode || '',
          offerId: discount.offer?._id ? String(discount.offer._id) : '',
        }
      });

      registration.razorpayOrderId = order.id;
      await registration.save();

      await createPurchaseDiscount({
        userId,
        purchaseType: 'event',
        targetId: event._id,
        discount,
        providerOrderId: order.id,
        referenceType: 'event',
        referenceId: registration._id,
        metadata: { eventId: String(event._id), registrationId: String(registration._id) },
      });
    } catch (orderError) {
      console.error("❌ Event order creation failed:", orderError.message);
      await releaseSeat(registration);
      await revertDiscountForRegistration(registration);

      if (isNewRegistration) {
        await EventRegistration.findByIdAndDelete(registration._id);
      } else {
        registration.status = 'pending';
        registration.paymentStatus = 'pending';
        await registration.save();
      }

      return res.status(502).json({
        success: false,
        message: "Could not start payment. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order created. Complete payment to confirm your registration.",
      data: {
        registrationId: registration._id.toString(),
        razorpay: {
          orderId: order.id,
          amount: order.amount,
          baseAmount: discount.baseAmount,
          discountAmount: discount.discountAmount,
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

    let registration = await EventRegistration.findOne({ userId, eventId });
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "No pending registration found. Please register and pay again."
      });
    }

    // Bind payment to this registration — an order-less pending registration
    // must go through the order/payment-link flow instead.
    if (!registration.razorpayOrderId || registration.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: "Payment does not belong to this registration"
      });
    }

    // Fetch and validate payment details from Razorpay.
    // Strict captured/order/amount checks only apply against live Razorpay —
    // in mock test mode the signature check above is the verification.
    let paymentDetails;
    try {
      paymentDetails = await fetchPaymentDetails(razorpay_payment_id);
      if (!isRazorpayTestMode) {
        if (paymentDetails.status !== 'captured') {
          return res.status(400).json({ success: false, message: "Payment not captured" });
        }
        if (paymentDetails.order_id !== razorpay_order_id) {
          return res.status(400).json({ success: false, message: "Payment order mismatch" });
        }
        if (Number(paymentDetails.amount) !== Math.round(Number(registration.paymentAmount) * 100)) {
          return res.status(400).json({ success: false, message: "Payment amount mismatch" });
        }
      }
    } catch (e) {
      return res.status(400).json({ success: false, message: "Could not verify payment with Razorpay" });
    }

    if (registration.status === 'confirmed' && registration.paymentStatus === 'completed') {
      await ensureTicketId(registration);
      await syncEventAttendeeCount(eventId);
      return res.status(200).json({
        success: true,
        message: "Payment was already confirmed. You are registered for this event.",
        registration: {
          _id: registration._id,
          status: registration.status,
          paymentStatus: registration.paymentStatus,
          ticketId: registration.ticketId || null
        }
      });
    }

    if (registration.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "This registration is not waiting for payment confirmation anymore."
      });
    }

    // Atomic flip — a retry/double-tap cannot confirm twice.
    const confirmed = await EventRegistration.findOneAndUpdate(
      { _id: registration._id, status: 'pending' },
      {
        $set: {
          paymentStatus: 'completed',
          paymentId: razorpay_payment_id,
          paidAt: new Date(),
          status: 'confirmed',
        }
      },
      { new: true }
    );

    if (!confirmed) {
      const latest = await EventRegistration.findById(registration._id);
      if (latest?.status === 'confirmed' && latest.paymentStatus === 'completed') {
        await ensureTicketId(latest);
        await syncEventAttendeeCount(eventId);
        return res.status(200).json({
          success: true,
          message: "Payment was already confirmed. You are registered for this event.",
          registration: {
            _id: latest._id,
            status: latest.status,
            paymentStatus: latest.paymentStatus,
            ticketId: latest.ticketId || null
          }
        });
      }
      return res.status(400).json({
        success: false,
        message: "This registration is not waiting for payment confirmation anymore."
      });
    }

    registration = confirmed;
    await ensureTicketId(registration);

    await applyPurchaseDiscount({
      providerOrderId: razorpay_order_id,
      referenceType: 'event',
      referenceId: registration._id,
    });

    // Referral: reward the referrer when the paid registration is confirmed
    if (req.user?.referredBy) {
      const { fireTrigger } = await import('../../services/referral.service.js');
      fireTrigger('user.event_register', { referrerId: req.user.referredBy, referredUserId: userId }).catch(() => {});
    }

    await releaseSeat(registration);

    const event = await Event.findById(eventId).select('title');
    const amountInRupees = (paymentDetails.amount && typeof paymentDetails.amount === 'number')
      ? paymentDetails.amount / 100
      : registration.paymentAmount;

    recordTransaction({
      userId,
      source: 'event',
      sourceId: registration._id.toString(),
      amount: amountInRupees,
      provider: 'razorpay',
      providerRef: razorpay_payment_id,
      metadata: { eventName: event?.title, orderId: razorpay_order_id, paymentId: razorpay_payment_id },
    }).catch(err => console.error('Transaction recording failed:', err.message));

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          payments: {
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            amount: amountInRupees,
            plan: `Event - ${event?.title || 'Event'}`,
            status: 'completed',
            date: new Date()
          }
        }
      },
      { new: true }
    ).select('email displayName');

    if (user) {
      sendEventRegistrationEmail(user, event?.title, amountInRupees);
    }

    await syncEventAttendeeCount(eventId);

    sendNotification(userId, {
      type: 'event_registered',
      title: 'Event Registration Confirmed! 🎟️',
      message: `You're registered for ${event?.title || 'the event'}.`,
      icon: '🎟️',
      priority: 'high',
      relatedId: eventId,
      relatedType: 'event',
      actionUrl: `/event-detail?eventId=${eventId}`,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Payment confirmed. You are registered for this event.",
      registration: {
        _id: registration._id,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        ticketId: registration.ticketId || null
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

/**
 * Create payment link for event registration (hosted checkout – works without native SDK)
 * POST /api/events/:eventId/register/link
 */
export const createEventRegistrationLink = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    const { name, email, phone, notes, couponCode } = req.body;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (!event.canRegister()) return res.status(400).json({ success: false, message: "Registration not available" });

    const basePrice = event.getCurrentPrice?.() ?? event.price ?? 0;
    if (basePrice <= 0) return res.status(400).json({ success: false, message: "Use free registration for this event" });

    const discount = await resolvePurchaseDiscount({
      userId,
      purchaseType: 'event',
      targetId: event._id,
      amount: basePrice,
      couponCode,
    });
    if (discount.error) return res.status(400).json({ success: false, message: discount.error });
    const currentPrice = Number(discount.finalAmount || 0);
    if (currentPrice <= 0) {
      return res.status(400).json({ success: false, message: 'This discount makes the event free. Please contact support.' });
    }

    let registration = await EventRegistration.findOne({ userId, eventId });
    if (registration && ['confirmed', 'attended'].includes(registration.status)) {
      return res.status(400).json({ success: false, message: "Already registered" });
    }

    const user = await User.findById(userId).select('displayName name email phone');
    const participantName = name || user?.displayName || user?.name || '';
    const participantEmail = email || user?.email || '';
    const participantPhone = phone || user?.phone || '';

    const isNewRegistration = !registration;
    if (!registration) {
      registration = new EventRegistration({ userId, eventId });
    }
    applyRegistrationState({
      registration,
      currentPrice,
      participantName,
      participantEmail,
      participantPhone,
      notes,
      isSimulatedPayment: false,
    });
    registration.baseAmount = discount.baseAmount;
    registration.discountAmount = discount.discountAmount;
    registration.couponCode = discount.couponCode;
    registration.offerId = discount.offer?._id || null;
    registration.offerTitle = discount.offerTitle;
    registration.status = 'pending';
    registration.paymentStatus = 'pending';
    registration.paymentId = null;
    registration.paidAt = null;
    await registration.save();

    // Reserve a seat for paid registrations to prevent overselling
    if (!registration.seatReserved) {
      const reservedEvent = await reserveSeat(eventId, registration);
      if (!reservedEvent) {
        if (isNewRegistration) {
          await EventRegistration.findByIdAndDelete(registration._id);
        } else {
          await cancelRegistrationWithSideEffects(registration, {
            cancelledBy: 'system',
            reason: 'Event is full',
            refund: false,
          });
        }
        return res.status(400).json({
          success: false,
          message: "This event is full. No seats available."
        });
      }
    }

    // Reuse an existing payment link only when it matches the current price.
    if (registration.paymentLinkId && registration.paymentLinkUrl) {
      const expiresAt = registration.paymentLinkExpiresAt;
      const sameAmount = Number(registration.paymentLinkAmount) === Number(currentPrice);
      if (sameAmount && (!expiresAt || new Date(expiresAt).getTime() > Date.now() + 5 * 60 * 1000)) {
        return res.status(200).json({
          success: true,
          data: {
            url: registration.paymentLinkUrl,
            paymentLinkId: registration.paymentLinkId,
            registrationId: registration._id.toString(),
            isTestMode: isRazorpayTestMode,
            paymentAmount: currentPrice,
            event: buildEventSummary(event),
          },
        });
      }
    }

    const customer = {
      name: participantName || 'Participant',
      email: participantEmail || undefined,
      contact: participantPhone ? String(participantPhone).replace('+91', '').trim() : undefined,
    };
    let link;
    try {
      link = await createRazorpayPaymentLink({
        amount: currentPrice,
        currency: (event.currency || 'INR').toUpperCase(),
        description: `Event: ${event.title || 'Event'}`,
        customer,
        notes: {
          type: 'event',
          eventId: String(eventId),
          registrationId: String(registration._id),
          userId: String(userId),
          baseAmount: String(discount.baseAmount),
          discountAmount: String(discount.discountAmount),
          finalAmount: String(discount.finalAmount),
          couponCode: discount.couponCode || '',
          offerId: discount.offer?._id ? String(discount.offer._id) : '',
        },
      });

      await createPurchaseDiscount({
        userId,
        purchaseType: 'event',
        targetId: event._id,
        discount,
        providerPaymentLinkId: link.id,
        referenceType: 'event',
        referenceId: registration._id,
        metadata: { eventId: String(event._id), registrationId: String(registration._id) },
      });

      registration.paymentLinkId = link.id;
      registration.paymentLinkUrl = link.short_url;
      registration.paymentLinkExpiresAt = link.expire_by ? new Date(link.expire_by * 1000) : null;
      registration.paymentLinkAmount = currentPrice;
      await registration.save();
    } catch (linkError) {
      console.error("❌ Event payment link creation failed:", linkError.message);
      await releaseSeat(registration);
      await revertDiscountForRegistration(registration);

      if (isNewRegistration) {
        await EventRegistration.findByIdAndDelete(registration._id);
      } else {
        registration.status = 'pending';
        registration.paymentStatus = 'pending';
        await registration.save();
      }

      return res.status(502).json({
        success: false,
        message: "Could not create a payment link. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        url: link.short_url,
        paymentLinkId: link.id,
        expiresAt: registration.paymentLinkExpiresAt,
        registrationId: registration._id.toString(),
        isTestMode: isRazorpayTestMode,
        paymentAmount: currentPrice,
        event: buildEventSummary(event),
      },
    });
  } catch (error) {
    console.error("❌ Create event link error:", error);
    return res.status(500).json({ success: false, message: error?.message || "Failed to create payment link" });
  }
};

/**
 * Confirm event payment link and mark registration confirmed
 * POST /api/events/:eventId/register/confirm-link
 */
export const confirmEventPaymentByLink = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    const { paymentLinkId } = req.body;
    if (!paymentLinkId) return res.status(400).json({ success: false, message: "paymentLinkId required" });

    if (isRazorpayTestMode) {
      const confirmed = await EventRegistration.findOneAndUpdate(
        { userId, eventId, status: 'pending', paymentLinkId },
        {
          $set: {
            paymentStatus: 'completed',
            paymentId: `pay_test_${Date.now()}`,
            paidAt: new Date(),
            status: 'confirmed',
          }
        },
        { sort: { updatedAt: -1 }, new: true }
      );

      if (!confirmed) {
        const existing = await EventRegistration.findOne({ userId, eventId, paymentLinkId });
        if (existing?.status === 'confirmed' && existing.paymentStatus === 'completed') {
          await ensureTicketId(existing);
          return res.status(200).json({
            success: true,
            message: "Payment was already confirmed. You are registered for this event.",
            data: {
              registration: {
                _id: existing._id,
                status: existing.status,
                paymentStatus: existing.paymentStatus,
                ticketId: existing.ticketId || null,
              },
            },
          });
        }
        return res.status(404).json({ success: false, message: "Pending registration not found or already confirmed" });
      }

      await ensureTicketId(confirmed);
      await releaseSeat(confirmed);
      await syncEventAttendeeCount(eventId);
      await applyPurchaseDiscount({
        providerPaymentLinkId: paymentLinkId,
        referenceType: 'event',
        referenceId: confirmed._id,
      });

      return res.status(200).json({
        success: true,
        message: "Test payment confirmed. You are registered for this event.",
        data: {
          registration: {
            _id: confirmed._id,
            status: confirmed.status,
            paymentStatus: confirmed.paymentStatus,
            ticketId: confirmed.ticketId || null,
          },
        },
      });
    }

    const link = await fetchPaymentLink(paymentLinkId);
    const status = String(link?.status || '').toLowerCase();
    const notes = link?.notes || {};
    if (notes?.userId && String(notes.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Payment link does not belong to you" });
    }
    if (status !== 'paid' && status !== 'captured') {
      return res.status(400).json({ success: false, data: { status: link?.status }, message: "Payment not completed yet" });
    }

    const registrationId = notes?.registrationId;
    if (!registrationId) return res.status(400).json({ success: false, message: "Invalid payment link" });
    const registration = await EventRegistration.findOne({ _id: registrationId, userId, eventId });
    if (!registration) return res.status(404).json({ success: false, message: "Registration not found" });

    if (registration.status === 'confirmed' && registration.paymentStatus === 'completed') {
      await syncEventAttendeeCount(eventId);
      return res.status(200).json({
        success: true,
        message: "Payment was already confirmed. You are registered for this event.",
        data: { registration: { _id: registration._id, status: registration.status, paymentStatus: registration.paymentStatus } },
      });
    }

    // Validate amount against server-stored registration amount (skip in test mode)
    if (!isRazorpayTestMode) {
      const expectedPaise = Math.round((Number(registration.paymentAmount) || 0) * 100);
      const paidPaise = Number(link?.amount || link?.amount_paid || 0);
      if (expectedPaise > 0 && paidPaise !== expectedPaise) {
        return res.status(400).json({
          success: false,
          message: "Payment amount does not match event registration amount",
          data: { expected: expectedPaise, received: paidPaise }
        });
      }
    }

    const paymentsRaw = link?.payments;
    const firstPayment = Array.isArray(paymentsRaw) ? paymentsRaw[0] : paymentsRaw;
    const paymentId = firstPayment?.payment_id || link?.payment_id;

    // Idempotent confirmation: atomic update only if still pending
    const confirmed = await EventRegistration.findOneAndUpdate(
      { _id: registrationId, userId, eventId, status: 'pending' },
      {
        $set: {
          paymentStatus: 'completed',
          paymentId: paymentId || `pay_${Date.now()}`,
          paidAt: new Date(),
          status: 'confirmed',
        }
      },
      { new: true }
    );

    if (!confirmed) {
      const refreshed = await EventRegistration.findOne({ _id: registrationId, userId, eventId });
      if (!refreshed) {
        return res.status(404).json({ success: false, message: "Registration not found" });
      }
      await ensureTicketId(refreshed);
      return res.status(200).json({
        success: true,
        message: refreshed.status === 'confirmed'
          ? "Payment was already confirmed. You are registered for this event."
          : "This registration is not waiting for payment confirmation anymore.",
        data: {
          registration: {
            _id: refreshed._id,
            status: refreshed.status,
            paymentStatus: refreshed.paymentStatus,
            ticketId: refreshed.ticketId || null,
          },
        },
      });
    }

    await ensureTicketId(confirmed);
    await releaseSeat(confirmed);

    await applyPurchaseDiscount({
      providerPaymentLinkId: paymentLinkId,
      referenceType: 'event',
      referenceId: confirmed._id,
    });

    const event = await Event.findById(eventId).select('title');

    recordTransaction({
      userId,
      source: 'event',
      sourceId: confirmed._id.toString(),
      amount: confirmed.paymentAmount,
      provider: 'razorpay',
      providerRef: confirmed.paymentId,
      metadata: { eventName: event?.title, orderId: paymentLinkId, paymentId: confirmed.paymentId },
    }).catch(err => console.error('Transaction recording failed:', err.message));

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          payments: {
            orderId: paymentLinkId,
            paymentId: confirmed.paymentId,
            amount: confirmed.paymentAmount,
            plan: `Event - ${event?.title || 'Event'}`,
            status: 'completed',
            date: new Date(),
          }
        }
      },
      { new: true }
    ).select('email displayName');

    if (user) {
      sendEventRegistrationEmail(user, event?.title, confirmed.paymentAmount);
    }
    await syncEventAttendeeCount(eventId);

    // Notify user on confirmed paid registration via link
    const paidEvent = await Event.findById(eventId).select('title emoji eventDate');
    if (paidEvent) {
      sendNotification(userId, {
        type: 'event_registered',
        title: '🎟️ Event Registration Confirmed',
        message: `Payment received! You're confirmed for "${paidEvent.title}" on ${new Date(paidEvent.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
        icon: paidEvent.emoji || '📅',
        relatedId: paidEvent._id,
        relatedType: 'event',
        actionUrl: `/event-detail?eventId=${paidEvent._id}`,
        priority: 'high',
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: "Payment confirmed. You are registered for this event.",
      data: {
        registration: {
          _id: confirmed._id,
          status: confirmed.status,
          paymentStatus: confirmed.paymentStatus,
          ticketId: confirmed.ticketId || null,
        },
      },
    });
  } catch (error) {
    console.error("❌ Confirm event link error:", error);
    return res.status(500).json({ success: false, message: error?.message || "Failed to confirm payment" });
  }
};

