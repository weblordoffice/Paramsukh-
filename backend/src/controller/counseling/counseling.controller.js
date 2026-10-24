import Booking from '../../models/booking.models.js';
import { User } from '../../models/user.models.js';
import CounselingService from '../../models/counselingService.model.js';
import { sendNotification } from '../notifications/notifications.controller.js';
import { verifyRazorpaySignature, createRefund, fetchPaymentDetails, isRazorpayTestMode } from '../../services/razorpayService.js';
import { recordTransaction } from '../../services/transaction.service.js';
import { sendCounselingBookingEmail, sendBookingCancellationEmail } from '../../services/emailService.js';
import { sanitizeNotes } from '../../utils/sanitizeUtils.js';
import { formatTime12h } from '../../utils/dateTime.js';
import {
  formatInZone,
  normalizeTimeToHHmm,
  startOfUtcDay,
  toDateKey,
  zonedDateTimeToUtc,
} from '../../utils/timezone.js';
import {
  releaseBookingSlot,
  validateRescheduleTarget,
} from '../../services/counselingBooking.service.js';
import mongoose from 'mongoose';
import {
  applyPurchaseDiscount,
  createPurchaseDiscount,
  resolvePurchaseDiscount,
} from '../../services/purchaseDiscount.service.js';

const MAX_REFUND_STATUS_UPDATE_RETRIES = 3;
const REFUND_STATUS_UPDATE_RETRY_DELAY = 1000;

async function updateRefundStatusWithRetry(bookingId, updateData, retries = 0) {
  try {
    await Booking.findByIdAndUpdate(bookingId, { $set: updateData });
  } catch (error) {
    if (retries < MAX_REFUND_STATUS_UPDATE_RETRIES) {
      console.warn(`[RefundStatus] Update failed, retry ${retries + 1}/${MAX_REFUND_STATUS_UPDATE_RETRIES}`);
      await new Promise(resolve => setTimeout(resolve, REFUND_STATUS_UPDATE_RETRY_DELAY * (retries + 1)));
      return updateRefundStatusWithRetry(bookingId, updateData, retries + 1);
    }
    console.error(`[RefundStatus] Failed after ${MAX_REFUND_STATUS_UPDATE_RETRIES} retries:`, error.message);
    throw error;
  }
}

const parseClockMinutes = (value) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const validateServiceSchedule = (businessHours) => {
  if (!businessHours || typeof businessHours !== 'object') return null;
  for (const [day, hours] of Object.entries(businessHours)) {
    if (!hours || hours.isActive === false) continue;
    const start = parseClockMinutes(hours.start);
    const end = parseClockMinutes(hours.end);
    if (start == null || end == null || end <= start) {
      return `${day}: end time must be after start time`;
    }
    if (hours.breakStart || hours.breakEnd) {
      const breakStart = parseClockMinutes(hours.breakStart);
      const breakEnd = parseClockMinutes(hours.breakEnd);
      if (breakStart == null || breakEnd == null || breakEnd <= breakStart) {
        return `${day}: break end must be after break start`;
      }
      if (breakStart < start || breakEnd > end) {
        return `${day}: break must be inside the working hours`;
      }
    }
  }
  return null;
};

const parseDurationMinutes = (duration) => {
  const match = String(duration || '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

export const getAllServices = async (req, res) => {
  try {
    const services = await CounselingService.find({ isActive: true });
    res.status(200).json({
      success: true,
      data: { services }
    });
  } catch (error) {
    console.error('Get Counseling Services Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
      error: error.message
    });
  }
};

export const getAllServicesAdmin = async (req, res) => {
  try {
    console.log('📋 Fetching all counseling services (Admin)...');
    const services = await CounselingService.find({}).sort({ createdAt: -1 });
    
    console.log(`✅ Found ${services.length} counseling services`);
    
    res.status(200).json({
      success: true,
      data: { services },
      count: services.length
    });
  } catch (error) {
    console.error('❌ Get Counseling Services (Admin) Error:', error);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch counseling services',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const createService = async (req, res) => {
  try {
    const { title, description, counselorName, counselorImage, category, duration, price, currencyCode, isActive, onlineMeetingLink, meetingPlatform, meetingPassword, availableSlots, businessHours, intervalMinutes, timezone } = req.body;

    if (!String(title || '').trim()) {
      return res.status(400).json({ success: false, message: 'Service title is required' });
    }
    const duplicate = await CounselingService.findOne({
      title: { $regex: `^${String(title).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    });
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'A service with this title already exists' });
    }

    const numericPrice = Number(price) || 0;
    if (numericPrice < 0) {
      return res.status(400).json({ success: false, message: 'Price cannot be negative' });
    }

    const scheduleError = validateServiceSchedule(businessHours);
    if (scheduleError) {
      return res.status(400).json({ success: false, message: scheduleError });
    }

    const slotLength = Number(intervalMinutes) || 60;
    const durationMinutes = parseDurationMinutes(duration);
    if (slotLength < 5 || slotLength > 240) {
      return res.status(400).json({ success: false, message: 'Slot interval must be between 5 and 240 minutes' });
    }
    if (durationMinutes && slotLength > durationMinutes) {
      return res.status(400).json({ success: false, message: 'Slot interval cannot exceed the session duration' });
    }
    if (timezone) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid timezone' });
      }
    }

    const service = await CounselingService.create({
      title, description, counselorName, counselorImage, category, duration,
      price: numericPrice > 0 ? numericPrice : 0,
      currencyCode: currencyCode || 'INR',
      isActive: typeof isActive === 'boolean' ? isActive : true,
      onlineMeetingLink, meetingPlatform, meetingPassword, businessHours,
      intervalMinutes: slotLength,
      timezone: timezone || 'Asia/Kolkata',
    });
    res.status(201).json({
      success: true,
      data: { service }
    });
  } catch (error) {
    console.error('Create Service Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service',
      error: error.message
    });
  }
};

export const updateService = async (req, res) => {
  try {
    const allowed = ['title', 'description', 'counselorName', 'counselorImage', 'category', 'duration', 'price', 'currencyCode', 'isActive', 'onlineMeetingLink', 'meetingPlatform', 'meetingPassword', 'businessHours', 'intervalMinutes', 'timezone'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    if (update.title !== undefined) {
      update.title = String(update.title).trim();
      if (!update.title) {
        return res.status(400).json({ success: false, message: 'Service title cannot be empty' });
      }
      const duplicate = await CounselingService.findOne({
        _id: { $ne: req.params.id },
        title: { $regex: `^${update.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
      });
      if (duplicate) {
        return res.status(409).json({ success: false, message: 'A service with this title already exists' });
      }
    }

    if (update.price !== undefined && Number(update.price) < 0) {
      return res.status(400).json({ success: false, message: 'Price cannot be negative' });
    }

    const scheduleError = validateServiceSchedule(update.businessHours);
    if (scheduleError) {
      return res.status(400).json({ success: false, message: scheduleError });
    }

    if (update.intervalMinutes !== undefined) {
      const slotLength = Number(update.intervalMinutes);
      if (!Number.isFinite(slotLength) || slotLength < 5 || slotLength > 240) {
        return res.status(400).json({ success: false, message: 'Slot interval must be between 5 and 240 minutes' });
      }
    }

    if (update.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: update.timezone }).format(new Date());
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid timezone' });
      }
    }

    const service = await CounselingService.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.status(200).json({
      success: true,
      data: { service }
    });
  } catch (error) {
    console.error('Update Service Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service',
      error: error.message
    });
  }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid service id' });
    }

    const service = await CounselingService.findById(id);
    if (!service) {
      return res.status(200).json({ success: true, message: 'Service already deleted' });
    }

    const activeBookings = await Booking.countDocuments({
      $or: [
        { serviceId: service._id },
        { counselorType: service.title },
      ],
      status: { $in: ['pending', 'confirmed', 'waitlisted'] },
    });
    if (activeBookings > 0) {
      return res.status(409).json({
        success: false,
        message: `This service has ${activeBookings} active booking(s). Deactivate it instead of deleting.`
      });
    }

    await CounselingService.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Service deleted'
    });
  } catch (error) {
    console.error('Delete Service Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service',
      error: error.message
    });
  }
};

export const getAvailability = async (req, res) => {
  try {
    const { date, counselorType } = req.query;

    if (!date || !counselorType) {
      return res.status(400).json({
        success: false,
        message: 'Date and counselorType are required'
      });
    }

    const dateKey = toDateKey(date);
    if (!dateKey) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const availableSlots = await Booking.getAvailableSlots(dateKey, counselorType);

    res.status(200).json({
      success: true,
      data: {
        date,
        counselorType,
        availableSlots,
        totalSlots: availableSlots.length
      }
    });
  } catch (error) {
    console.error('Get Availability Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get availability',
      error: error.message
    });
  }
};

export const bookCounseling = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      counselorType,
      counselorName,
      bookingType,
      bookingTitle,
      bookingDate,
      bookingTime,
      userNotes,
      couponCode
    } = req.body;

    // Validate required fields
    if (!counselorType || !bookingDate || !bookingTime) {
      return res.status(400).json({
        success: false,
        message: 'Counselor type, booking date and booking time are required'
      });
    }

    // Validate the calendar date/time shape first
    const dateKey = toDateKey(bookingDate);
    const normalizedTime = normalizeTimeToHHmm(bookingTime);
    if (!dateKey || !normalizedTime) {
      return res.status(400).json({
        success: false,
        message: 'Booking date and time must be valid (date: YYYY-MM-DD, time: HH:mm)'
      });
    }

    // Resolve service from counselor type (title or ObjectId) and enforce server-side pricing
    const serviceQuery = mongoose.Types.ObjectId.isValid(String(counselorType))
      ? { _id: counselorType }
      : { title: counselorType };

    const service = await CounselingService.findOne(serviceQuery);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Selected counseling service not found'
      });
    }

    if (!service.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Selected counseling service is currently inactive'
      });
    }

    const timezone = service.timezone || 'Asia/Kolkata';
    const slotInstant = zonedDateTimeToUtc(dateKey, normalizedTime, timezone);
    if (!slotInstant || slotInstant < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book a slot that has already passed.'
      });
    }

    // BOOKING LIMIT: pending/confirmed bookings only (waitlisted does not count)
    const userBookingCount = await Booking.countDocuments({
      user: userId,
      status: { $in: ['pending', 'confirmed'] },
      bookingDate: { $gte: startOfUtcDay(new Date()) }
    });

    const MAX_ACTIVE_BOOKINGS = 5;
    if (userBookingCount >= MAX_ACTIVE_BOOKINGS) {
      return res.status(400).json({
        success: false,
        message: `You have reached the maximum limit of ${MAX_ACTIVE_BOOKINGS} active bookings. Please cancel or complete some bookings before creating new ones.`,
        currentBookings: userBookingCount
      });
    }

    // Slot must exist in the schedule (business hours, break, exceptions, future).
    // A valid-but-taken slot is allowed through so it can become a waitlist entry.
    const slotIsValid = await Booking.isValidSlot(dateKey, service._id, normalizedTime);
    if (!slotIsValid) {
      return res.status(400).json({
        success: false,
        message: 'This time is outside the counselor availability. Please select another slot.',
        availableSlots: await Booking.getAvailableSlots(dateKey, service._id)
      });
    }

    const finalCounselorType = service.title;
    const finalCounselorName = service.counselorName || counselorName || 'Expert Counselor';
    const finalBookingType = bookingType || service.title;
    const finalBookingTitle = bookingTitle || service.title;

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Determine if booking is free or paid (server-side pricing)
    const servicePrice = Number(service.price) || 0;
    const baseAmount = Boolean(service.isFree || servicePrice === 0) ? 0 : servicePrice;
    const discount = await resolvePurchaseDiscount({
      userId,
      purchaseType: 'counseling',
      targetId: service._id,
      amount: baseAmount,
      couponCode,
    });
    if (discount.error) {
      return res.status(400).json({ success: false, message: discount.error });
    }

    const isFree = baseAmount === 0 || Number(discount.finalAmount || 0) <= 0;
    const bookingAmount = isFree ? 0 : Number(discount.finalAmount || 0);

    // The client amount is advisory only; the server price is authoritative.
    const clientAmount = Number(req.body.amount);
    if (Number.isFinite(clientAmount) && clientAmount > 0 && Math.abs(clientAmount - bookingAmount) > 0.01) {
      console.warn(`[Counseling] Client amount ${clientAmount} differs from server amount ${bookingAmount} for user ${userId}`);
    }

    const bookingDateObj = startOfUtcDay(dateKey);

    // Try to create booking - unique index will prevent race conditions
    const booking = new Booking({
      user: userId,
      serviceId: service._id,
      timezone,
      counselorType: finalCounselorType,
      counselorName: finalCounselorName,
      bookingType: finalBookingType,
      bookingTitle: finalBookingTitle,
      bookingDate: bookingDateObj,
      bookingTime: normalizedTime,
      userNotes: sanitizeNotes(userNotes),
      userPhone: user.phone || 'N/A',
      userEmail: user.email || '',
      isFree,
      amount: bookingAmount,
      baseAmount: discount.baseAmount,
      discountAmount: discount.discountAmount,
      couponCode: discount.couponCode,
      offerId: discount.offer?._id || null,
      offerTitle: discount.offerTitle,
      paymentStatus: isFree ? 'not_required' : 'pending',
      status: isFree ? 'confirmed' : 'pending'
    });

    try {
      await booking.save();

      if (!isFree && discount.discountAmount > 0) {
        await createPurchaseDiscount({
          userId,
          purchaseType: 'counseling',
          targetId: service._id,
          discount,
          referenceType: 'counseling',
          referenceId: booking._id,
          metadata: { bookingId: String(booking._id), serviceId: String(service._id) },
        });
      }
    } catch (dbError) {
      if (dbError.code === 11000) {
        // Slot taken — create a waitlist entry (does not hold the slot).
        const waitlistCount = await Booking.countDocuments({
          serviceId: service._id,
          bookingDate: bookingDateObj,
          bookingTime: normalizedTime,
          status: 'waitlisted',
        });

        const waitlistRank = waitlistCount + 1;

        const waitlistedBooking = new Booking({
          user: userId,
          serviceId: service._id,
          timezone,
          counselorType: finalCounselorType,
          counselorName: finalCounselorName,
          bookingType: finalBookingType,
          bookingTitle: finalBookingTitle,
          bookingDate: bookingDateObj,
          bookingTime: normalizedTime,
          userNotes: sanitizeNotes(userNotes),
          userPhone: user.phone || 'N/A',
          userEmail: user.email || '',
          isFree,
          amount: bookingAmount,
          baseAmount: discount.baseAmount,
          discountAmount: discount.discountAmount,
          couponCode: discount.couponCode,
          offerId: discount.offer?._id || null,
          offerTitle: discount.offerTitle,
          paymentStatus: isFree ? 'not_required' : 'pending',
          status: 'waitlisted',
          waitlistRank
        });

        await waitlistedBooking.save();

        await sendNotification(userId, {
          type: 'counseling_waitlist',
          title: 'Added to Waitlist',
          message: `You are #${waitlistRank} on the waitlist for ${finalBookingTitle} on ${formatInZone(slotInstant, timezone)}. We'll notify you when a spot opens.`,
          icon: '📅',
          priority: 'medium',
          relatedId: waitlistedBooking._id,
          relatedType: 'booking',
          actionUrl: `/counseling-detail?bookingId=${waitlistedBooking._id}`,
        }).catch(() => {});

        return res.status(200).json({
          success: true,
          message: `You've been added to the waitlist (position #${waitlistRank}). We'll notify you if a spot opens up.`,
          data: {
            booking: waitlistedBooking,
            waitlistRank,
            isWaitlisted: true
          }
        });
      }
      throw dbError;
    }

    // Send the confirmation email only for confirmed (free) bookings.
    if (booking.status === 'confirmed') {
      try {
        const emailPromise = sendCounselingBookingEmail(user, booking);
        if (emailPromise && typeof emailPromise.catch === 'function') {
          emailPromise.catch((err) =>
            console.error('[Email] Booking confirmation email failed:', err?.message || err)
          );
        }
      } catch (emailErr) {
        console.error('[Email] Booking confirmation email threw synchronously:', emailErr?.message || emailErr);
      }
    }

    const slotLabel = formatInZone(slotInstant, timezone);

    // Send notification to user
    await sendNotification(userId, {
      type: 'counseling_booked',
      title: isFree ? 'Counseling Session Booked' : 'Booking Awaiting Payment',
      message: isFree
        ? `Your ${finalBookingTitle} session is scheduled for ${slotLabel}`
        : `Your ${finalBookingTitle} session is reserved for ${slotLabel}. Complete payment to confirm your booking.`,
      icon: isFree ? '📅' : '💳',
      priority: 'high',
      relatedId: booking._id,
      relatedType: 'booking',
      actionUrl: `/counseling-detail?bookingId=${booking._id}`
    });

    // Referral: reward the referrer when their referred user books a session
    if (user?.referredBy) {
      const { fireTrigger } = await import('../../services/referral.service.js');
      fireTrigger('user.counseling_book', { referrerId: user.referredBy, referredUserId: userId }).catch(() => {});
    }

    // COUNSELOR NOTIFICATION: Notify admins about new booking
    try {
      const { User } = await import('../../models/user.models.js');
      const admins = await User.find({ role: 'admin' }).select('_id');
      
      for (const admin of admins) {
        await sendNotification(admin._id, {
          type: 'counseling_booked',
          title: isFree ? 'New Booking Received' : 'New Booking Request (Payment Pending)',
          message: isFree
            ? `${user.displayName} booked ${finalBookingTitle} on ${slotLabel}`
            : `${user.displayName} requested ${finalBookingTitle} on ${slotLabel} — awaiting payment`,
          icon: isFree ? '🔔' : '💳',
          priority: 'high',
          relatedId: booking._id,
          relatedType: 'booking'
        });
      }
      console.log(`🔔 Notified ${admins.length} admin(s) about new booking`);
    } catch (error) {
      console.error('⚠️ Failed to notify admins:', error.message);
    }

    res.status(201).json({
      success: true,
      message: 'Counseling session booked successfully',
      data: { booking }
    });
  } catch (error) {
    console.error('Book Counseling Error:', error);
    
    // Handle unique index violation (double booking prevention)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'This time slot was just booked by another user. Please select a different time.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to book counseling session',
      error: error.message
    });
  }
};

// @desc    Get user's bookings
// @route   GET /api/counseling/my-bookings
// @access  Private
export const getMyBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, upcoming = false } = req.query;

    let query = { user: userId };

    if (status) {
      query.status = status;
    }

    if (upcoming === 'true') {
      query.bookingDate = { $gte: startOfUtcDay(new Date()) };
      query.status = { $in: ['pending', 'confirmed', 'waitlisted'] };
    }

    const bookings = await Booking.find(query)
      .sort({ bookingDate: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        bookings,
        total: bookings.length
      }
    });
  } catch (error) {
    console.error('Get My Bookings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bookings',
      error: error.message
    });
  }
};

// @desc    Get booking details
// @route   GET /api/counseling/:bookingId
// @access  Private
export const getBookingDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookingId } = req.params;

    const booking = await Booking.findOne({
      _id: bookingId,
      user: userId
    }).populate('user', 'displayName email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { booking }
    });
  } catch (error) {
    console.error('Get Booking Details Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve booking details',
      error: error.message
    });
  }
};

// @desc    Cancel a booking
// @route   PATCH /api/counseling/:bookingId/cancel
// @access  Private
export const cancelBooking = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }
    if (!['pending', 'confirmed', 'waitlisted'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a ${booking.status} booking`
      });
    }

    // The 24h window applies to confirmed sessions only. Pending/waitlisted
    // bookings can be released immediately.
    if (booking.status === 'confirmed' && !booking.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'Bookings can only be cancelled at least 24 hours in advance'
      });
    }

    const shouldRefund = Boolean(
      !booking.isFree
      && booking.paymentStatus === 'paid'
      && booking.paymentId
      && !['processed', 'pending'].includes(booking.refundStatus)
    );

    const cancelled = await Booking.findOneAndUpdate(
      { _id: bookingId, user: userId, status: booking.status },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: reason || 'User requested cancellation',
          cancelledBy: 'user',
          refundStatus: shouldRefund ? 'pending' : (booking.refundStatus || null)
        }
      },
      { new: true }
    );

    if (!cancelled) {
      return res.status(409).json({
        success: false,
        message: 'This booking changed while you were cancelling it. Please refresh and try again.'
      });
    }

    let refundStatus = cancelled.refundStatus;

    if (shouldRefund) {
      try {
        // createRefund expects rupees and converts to paise internally.
        const refund = await createRefund(
          cancelled.paymentId,
          cancelled.amount,
          {
            type: 'counseling',
            bookingId: cancelled._id.toString(),
            userId: userId.toString(),
            reason: reason || 'User cancellation',
            cancelled_by: 'user'
          }
        );

        await updateRefundStatusWithRetry(bookingId, {
          refundId: refund.id,
          refundAmount: cancelled.amount,
          refundStatus: 'processed',
          refundProcessedAt: new Date(),
          refundError: null,
          paymentStatus: 'refunded'
        });
        refundStatus = 'processed';

        const { recordRefund } = await import('../../services/transaction.service.js');
        recordRefund({ sourceId: cancelled._id.toString(), refundAmount: cancelled.amount }).catch((err) =>
          console.error('Refund recording failed:', err.message)
        );

        console.log(`✅ Refund processed: ${refund.id}`);
      } catch (refundError) {
        console.error('❌ Refund processing failed:', refundError.message);
        refundStatus = 'failed';
        await updateRefundStatusWithRetry(bookingId, {
          refundStatus: 'failed',
          refundError: refundError.message
        });
      }
    }

    // Free the slot and promote the next waitlisted user. A waitlisted booking
    // never held the slot, so cancelling it must not promote anyone.
    if (booking.status !== 'waitlisted') {
      await releaseBookingSlot(cancelled);
    }

    // Send notification
    await sendNotification(userId, {
      type: 'counseling_cancelled',
      title: 'Booking Cancelled',
      message: refundStatus === 'processed'
        ? `Your counseling session was cancelled and ₹${cancelled.amount} has been refunded.`
        : 'Your counseling session has been cancelled.',
      icon: '❌',
      priority: 'medium',
      relatedId: cancelled._id,
      relatedType: 'booking',
      actionUrl: `/counseling-detail?bookingId=${cancelled._id}`
    }).catch(() => {});

    // Send cancellation email
    try {
      const bookingUser = await User.findById(userId).select('email displayName');
      if (bookingUser) sendBookingCancellationEmail(bookingUser, cancelled);
    } catch (emailErr) {
      console.error('Booking cancellation email failed:', emailErr?.message || emailErr);
    }

    res.status(200).json({
      success: true,
      message: refundStatus === 'failed'
        ? 'Booking cancelled, but the refund could not be processed automatically.'
        : 'Booking cancelled successfully',
      refundStatus,
      data: { booking: { ...cancelled.toObject(), refundStatus }, refundStatus }
    });
  } catch (error) {
    console.error('Cancel Booking Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message
    });
  }
};

// @desc    Request reschedule (user → admin approval required)
// @route   POST /api/counseling/:bookingId/reschedule-request
// @access  Private
export const requestReschedule = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookingId } = req.params;
    const { newDate, newTime, reason } = req.body;

    if (!newDate || !newTime) {
      return res.status(400).json({ success: false, message: 'New date and time are required' });
    }

    const booking = await Booking.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['cancelled', 'completed', 'no_show'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: `Cannot reschedule a ${booking.status} booking` });
    }

    if (booking.rescheduleRequest?.status === 'pending') {
      return res.status(400).json({ success: false, message: 'A reschedule request is already pending for this booking' });
    }

    if (!booking.isFree && booking.paymentStatus === 'pending') {
      return res.status(400).json({ success: false, message: 'Please complete payment before requesting a reschedule' });
    }

    if (!booking.canBeRescheduled()) {
      return res.status(400).json({
        success: false,
        message: 'Bookings can only be rescheduled at least 48 hours in advance'
      });
    }

    const user = await User.findById(userId);
    const target = await validateRescheduleTarget(booking, newDate, newTime);
    if (target.error) {
      return res.status(target.conflict ? 409 : 400).json({ success: false, message: target.error });
    }

    booking.rescheduleRequest = {
      status: 'pending',
      requestedBy: 'user',
      requestedNewDate: target.bookingDate,
      requestedNewTime: target.time,
      reason: reason || 'User requested reschedule',
      respondedAt: null,
      responseNote: null
    };
    await booking.save();

    // Notify all admins
    try {
      const admins = await User.find({ role: 'admin' }).select('_id');
      for (const admin of admins) {
        await sendNotification(admin._id, {
          type: 'reschedule_request',
          title: 'Reschedule Request',
          message: `User ${user?.displayName || 'A user'} requested to reschedule "${booking.bookingTitle}" from ${formatInZone(booking.bookingDate, booking.timezone)} ${formatTime12h(booking.bookingTime)} to ${formatInZone(target.bookingDate, booking.timezone)} ${formatTime12h(target.time)}`,
          icon: '📅',
          priority: 'high',
          relatedId: booking._id,
          relatedType: 'booking',
          actionUrl: `/counseling-detail?bookingId=${booking._id}`
        });
      }
    } catch (notifErr) {
      console.error('Failed to notify admins:', notifErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Reschedule request submitted. You will be notified once admin reviews it.',
      data: { booking }
    });
  } catch (error) {
    console.error('Request Reschedule Error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit reschedule request', error: error.message });
  }
};

// @desc    User responds to admin-initiated reschedule request
// @route   POST /api/counseling/:bookingId/reschedule-respond
// @access  Private
export const respondToReschedule = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookingId } = req.params;
    const { action, responseNote } = req.body;

    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "approve" or "deny"' });
    }

    const booking = await Booking.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!booking.rescheduleRequest || booking.rescheduleRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending reschedule request for this booking' });
    }

    if (booking.rescheduleRequest.requestedBy !== 'admin') {
      return res.status(400).json({ success: false, message: 'This reschedule request is not from admin' });
    }

    if (action === 'approve') {
      const target = await validateRescheduleTarget(
        booking,
        booking.rescheduleRequest.requestedNewDate,
        booking.rescheduleRequest.requestedNewTime
      );
      if (target.error) {
        return res.status(target.conflict ? 409 : 400).json({
          success: false,
          message: target.error
        });
      }

      let moved;
      try {
        moved = await Booking.findOneAndUpdate(
          {
            _id: bookingId,
            user: userId,
            status: booking.status,
            'rescheduleRequest.status': 'pending'
          },
          {
            $set: {
              bookingDate: target.bookingDate,
              bookingTime: target.time,
              rescheduledFrom: booking.bookingDate,
              rescheduledReason: responseNote || 'Admin proposed reschedule accepted by user',
              rescheduledBy: 'admin',
              'rescheduleRequest.status': 'approved',
              'rescheduleRequest.respondedAt': new Date(),
              'rescheduleRequest.responseNote': responseNote || null,
              reminder24SentAt: null,
              reminder1SentAt: null,
              reminderSent: false,
              reminderSentAt: null,
              paymentDueAt: null
            }
          },
          { new: true }
        );
      } catch (moveError) {
        if (moveError.code === 11000) {
          return res.status(409).json({
            success: false,
            message: 'The requested time slot has just been taken. Please choose another time.'
          });
        }
        throw moveError;
      }

      if (!moved) {
        return res.status(409).json({
          success: false,
          message: 'This reschedule request changed while you were responding. Please refresh.'
        });
      }

      await sendNotificationToAdmins({
        type: 'reschedule_approved',
        title: 'Reschedule Approved',
        message: `User accepted the reschedule for "${moved.bookingTitle}". New time: ${formatInZone(moved.bookingDate, moved.timezone)} ${formatTime12h(moved.bookingTime)}`,
        icon: '✅',
        priority: 'high',
        relatedId: moved._id,
        relatedType: 'booking'
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Reschedule approved. Your session has been moved.',
        data: { booking: moved }
      });
    }

    const denied = await Booking.findOneAndUpdate(
      { _id: bookingId, user: userId, 'rescheduleRequest.status': 'pending' },
      {
        $set: {
          'rescheduleRequest.status': 'denied',
          'rescheduleRequest.respondedAt': new Date(),
          'rescheduleRequest.responseNote': responseNote || null
        }
      },
      { new: true }
    );

    if (!denied) {
      return res.status(409).json({ success: false, message: 'No pending reschedule request to decline' });
    }

    await sendNotificationToAdmins({
      type: 'reschedule_denied',
      title: 'Reschedule Declined',
      message: `User declined the reschedule for "${denied.bookingTitle}". Original time remains: ${formatInZone(denied.bookingDate, denied.timezone)} ${formatTime12h(denied.bookingTime)}`,
      icon: '❌',
      priority: 'medium',
      relatedId: denied._id,
      relatedType: 'booking'
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Reschedule declined. Your original booking time is unchanged.',
      data: { booking: denied }
    });
  } catch (error) {
    console.error('Respond to Reschedule Error:', error);
    res.status(500).json({ success: false, message: 'Failed to respond to reschedule', error: error.message });
  }
};

// Helper to notify all admins
async function sendNotificationToAdmins(payload) {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    for (const admin of admins) {
      await sendNotification(admin._id, payload);
    }
  } catch (e) {
    console.error('Admin notification error:', e.message);
  }
}

// @desc    Reschedule a booking (direct — 48hr restriction)
// @route   PATCH /api/counseling/:bookingId/reschedule
// @access  Private
export const rescheduleBooking = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookingId } = req.params;
    const { newDate, newTime, reason } = req.body;

    if (!newDate || !newTime) {
      return res.status(400).json({ success: false, message: 'New date and time are required' });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      user: userId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (!booking.canBeRescheduled()) {
      return res.status(400).json({
        success: false,
        message: 'Bookings can only be rescheduled at least 48 hours in advance'
      });
    }

    // Prevent rescheduling unpaid bookings without completing payment first
    if (!booking.isFree && booking.paymentStatus === 'pending' && booking.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Please complete payment for this booking before rescheduling. Your booking is awaiting payment.',
        requiresPayment: true,
        bookingId: booking._id
      });
    }

    const target = await validateRescheduleTarget(booking, newDate, newTime);
    if (target.error) {
      return res.status(target.conflict ? 409 : 400).json({ success: false, message: target.error });
    }

    let updated;
    try {
      updated = await Booking.findOneAndUpdate(
        { _id: bookingId, user: userId, status: booking.status },
        {
          $set: {
            bookingDate: target.bookingDate,
            bookingTime: target.time,
            rescheduledFrom: booking.bookingDate,
            rescheduledReason: sanitizeNotes(reason) || 'User requested reschedule',
            rescheduledBy: 'user',
            reminder24SentAt: null,
            reminder1SentAt: null,
            reminderSent: false,
            reminderSentAt: null,
            paymentDueAt: null
          }
        },
        { new: true }
      );
    } catch (moveError) {
      if (moveError.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'The new time slot has just been taken. Please select another time.'
        });
      }
      throw moveError;
    }

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'This booking changed while you were rescheduling. Please refresh and try again.'
      });
    }

    // Send notification
    await sendNotification(userId, {
      type: 'counseling_rescheduled',
      title: 'Booking Rescheduled',
      message: `Your counseling session has been rescheduled to ${formatInZone(updated.bookingDate, updated.timezone)} at ${formatTime12h(updated.bookingTime)}`,
      icon: '📅',
      priority: 'high',
      relatedId: updated._id,
      relatedType: 'booking',
      actionUrl: `/counseling-detail?bookingId=${updated._id}`
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Booking rescheduled successfully',
      data: { booking: updated }
    });
  } catch (error) {
    console.error('Reschedule Booking Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule booking',
      error: error.message
    });
  }
};

// @desc    Update payment status (Razorpay: verify signature then confirm booking)
// @route   POST /api/counseling/:bookingId/payment
// @access  Private
export const updatePaymentStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookingId } = req.params;
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    const booking = await Booking.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.isFree) {
      return res.status(400).json({ success: false, message: 'This is a free booking, no payment required' });
    }

    // Check if booking is already confirmed - prevent double processing
    if (booking.status === 'confirmed' && booking.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Booking already confirmed',
        data: { booking }
      });
    }

    // Check if booking was cancelled - cannot process payment
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This booking has been cancelled and cannot be activated'
      });
    }

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Razorpay payment details required' });
    }

    // Bind payment to this booking. The order must have been created for it.
    if (!booking.razorpayOrderId || booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Payment does not belong to this booking' });
    }

    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Fetch and validate payment details from Razorpay.
    // Strict captured/order/amount checks only apply against live Razorpay —
    // in mock test mode the signature check above is the verification.
    let paymentDetails;
    try {
      paymentDetails = await fetchPaymentDetails(razorpay_payment_id);
      if (!isRazorpayTestMode) {
        if (paymentDetails.status !== 'captured') {
          return res.status(400).json({ success: false, message: 'Payment not captured' });
        }
        if (paymentDetails.order_id !== razorpay_order_id) {
          return res.status(400).json({ success: false, message: 'Payment order mismatch' });
        }
        if (Number(paymentDetails.amount) !== Math.round(Number(booking.amount) * 100)) {
          return res.status(400).json({ success: false, message: 'Payment amount mismatch' });
        }
      }
    } catch (e) {
      console.error('Update Payment Status Error:', e);
      return res.status(400).json({ success: false, message: 'Could not verify payment with Razorpay' });
    }

    // Replay protection
    const existingBooking = await Booking.findOne({
      _id: { $ne: bookingId },
      $or: [{ paymentId: razorpay_payment_id }, { razorpayOrderId: razorpay_order_id }]
    });
    if (existingBooking) {
      return res.status(400).json({ success: false, message: 'Payment already used for another booking' });
    }

    // Atomic confirmation — a retry cannot confirm twice or resurrect a cancelled booking.
    const confirmed = await Booking.findOneAndUpdate(
      { _id: bookingId, user: userId, status: 'pending', paymentStatus: { $ne: 'paid' } },
      {
        $set: {
          paymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          paymentMethod: 'razorpay',
          paymentStatus: 'paid',
          status: 'confirmed',
          paidAt: new Date(),
          paymentDueAt: null
        }
      },
      { new: true }
    );

    if (!confirmed) {
      const latest = await Booking.findById(bookingId);
      if (latest?.status === 'confirmed' && latest.paymentStatus === 'paid') {
        return res.status(200).json({
          success: true,
          message: 'Booking already confirmed',
          data: { booking: latest }
        });
      }
      return res.status(400).json({
        success: false,
        message: latest?.status === 'cancelled'
          ? 'This booking has been cancelled and cannot be activated'
          : 'This booking is not awaiting payment'
      });
    }

    await applyPurchaseDiscount({
      referenceType: 'counseling',
      referenceId: confirmed._id,
    });

    recordTransaction({
      userId: confirmed.user,
      source: 'counseling',
      sourceId: confirmed._id.toString(),
      amount: confirmed.amount || 0,
      provider: 'razorpay',
      providerRef: confirmed.paymentId,
      metadata: { paymentId: confirmed.paymentId },
    }).catch(err => console.error('Transaction recording failed:', err.message));

    await sendNotification(userId, {
      type: 'counseling_booked',
      title: 'Payment Confirmed',
      message: `Payment of ₹${confirmed.amount} received. Your counseling session is confirmed for ${formatInZone(confirmed.bookingDate, confirmed.timezone)} at ${formatTime12h(confirmed.bookingTime)}`,
      icon: '✅',
      priority: 'high',
      relatedId: confirmed._id,
      relatedType: 'booking',
      actionUrl: `/counseling-detail?bookingId=${confirmed._id}`
    }).catch(() => {});

    try {
      await sendCounselingBookingEmail(req.user, confirmed);
    } catch (emailErr) {
      console.error('Counseling booking email failed:', emailErr?.message || emailErr);
    }

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: { booking: confirmed }
    });
  } catch (error) {
    console.error('Update Payment Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: error.message
    });
  }
};

// @desc    Submit feedback for completed booking
// @route   POST /api/counseling/:bookingId/feedback
// @access  Private
export const submitFeedback = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bookingId } = req.params;
    const { rating, feedback } = req.body;

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Valid rating (1-5) is required'
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      user: userId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be submitted for completed sessions'
      });
    }

    // PREVENT MULTIPLE FEEDBACK: Check if feedback already submitted
    if (booking.feedbackSubmittedAt) {
      return res.status(400).json({
        success: false,
        message: 'Feedback has already been submitted for this session'
      });
    }

    booking.userRating = numericRating;
    booking.userFeedback = feedback || '';
    booking.feedbackSubmittedAt = Date.now();

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: { booking }
    });
  } catch (error) {
    console.error('Submit Feedback Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
};
