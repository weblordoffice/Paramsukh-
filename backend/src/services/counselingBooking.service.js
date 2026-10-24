import Booking from '../models/booking.models.js';
import CounselingService from '../models/counselingService.model.js';
import { sendNotification } from '../controller/notifications/notifications.controller.js';
import {
  normalizeTimeToHHmm,
  startOfUtcDay,
  toDateKey,
  zonedDateTimeToUtc,
} from '../utils/timezone.js';
import {
  createPurchaseDiscount,
  resolvePurchaseDiscount,
  revertPurchaseDiscount,
} from './purchaseDiscount.service.js';

const PROMOTION_WINDOW_MS = 30 * 60 * 1000;

export const revertDiscountForBooking = async (booking) => {
  if (!booking?._id) return null;
  return revertPurchaseDiscount({
    referenceType: 'counseling',
    referenceId: booking._id,
    providerOrderId: booking.razorpayOrderId || null,
    providerPaymentLinkId: booking.paymentLinkId || null,
  });
};

const resolveServiceForBooking = async (booking) => {
  if (booking.serviceId) {
    const byId = await CounselingService.findById(booking.serviceId);
    if (byId) return byId;
  }
  return CounselingService.findOne({ title: booking.counselorType });
};

/**
 * Promote the earliest waitlisted booking for a freed slot to pending and give
 * the user a 30-minute payment window. Returns the promoted booking or null.
 */
export const promoteNextWaitlisted = async (booking) => {
  if (!booking) return null;

  const candidate = await Booking.findOne({
    counselorType: booking.counselorType,
    bookingDate: booking.bookingDate,
    bookingTime: booking.bookingTime,
    status: 'waitlisted',
  }).sort({ waitlistRank: 1 });

  if (!candidate) return null;

  const promoted = await Booking.findOneAndUpdate(
    { _id: candidate._id, status: 'waitlisted' },
    {
      $set: {
        status: 'pending',
        waitlistRank: null,
        promotedAt: new Date(),
        paymentDueAt: new Date(Date.now() + PROMOTION_WINDOW_MS),
      }
    },
    { new: true }
  );

  if (!promoted) {
    return promoteNextWaitlisted(booking);
  }

  try {
    const service = await resolveServiceForBooking(promoted);
    if (promoted.isFree) {
      promoted.paymentStatus = 'not_required';
      promoted.status = 'confirmed';
      promoted.paymentDueAt = null;
      await promoted.save();
    } else if (service && Number(service.price) > 0) {
      const discount = await resolvePurchaseDiscount({
        userId: promoted.user,
        purchaseType: 'counseling',
        targetId: service._id,
        amount: Number(service.price),
        couponCode: promoted.couponCode || '',
      });

      if (!discount.error) {
        promoted.baseAmount = discount.baseAmount;
        promoted.discountAmount = discount.discountAmount;
        promoted.amount = Number(discount.finalAmount || 0);
        promoted.couponCode = discount.couponCode || null;
        promoted.offerId = discount.offer?._id || null;
        promoted.offerTitle = discount.offerTitle || null;

        if (promoted.amount <= 0) {
          promoted.isFree = true;
          promoted.paymentStatus = 'not_required';
          promoted.status = 'confirmed';
          promoted.paymentDueAt = null;
        } else {
          promoted.paymentStatus = 'pending';
        }

        await promoted.save();

        if (discount.discountAmount > 0) {
          await createPurchaseDiscount({
            userId: promoted.user,
            purchaseType: 'counseling',
            targetId: service._id,
            discount,
            referenceType: 'counseling',
            referenceId: promoted._id,
            metadata: {
              bookingId: String(promoted._id),
              serviceId: String(service._id),
              promotedFromWaitlist: true,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('Waitlist promotion pricing failed:', error?.message);
  }

  await sendNotification(promoted.user, {
    type: 'counseling_waitlist',
    title: 'Slot Available! 🎉',
    message: promoted.status === 'confirmed'
      ? `A spot opened up and your ${promoted.bookingTitle} session is confirmed.`
      : `A spot opened up for ${promoted.bookingTitle}. Complete payment within 30 minutes to confirm it.`,
    icon: '📅',
    priority: 'high',
    relatedId: promoted._id,
    relatedType: 'booking',
    actionUrl: `/counseling-detail?bookingId=${promoted._id}`,
  }).catch(() => {});

  return promoted;
};

/** Release a booking's slot and promote the next waitlisted user. */
export const releaseBookingSlot = async (booking) => {
  if (!booking) return null;
  return promoteNextWaitlisted(booking);
};

/**
 * Validate a proposed reschedule target: inside availability and free.
 */
export const validateRescheduleTarget = async (booking, newDate, newTime) => {
  const dateKey = toDateKey(newDate);
  const time = normalizeTimeToHHmm(newTime);
  if (!dateKey || !time) {
    return { error: 'New date and time must be valid' };
  }

  const serviceRef = booking.serviceId || booking.counselorType;
  const validSlot = await Booking.isValidSlot(dateKey, serviceRef, time);
  if (!validSlot) {
    return { error: 'The requested time is outside the counselor availability' };
  }

  const conflict = await Booking.findOne({
    _id: { $ne: booking._id },
    bookingDate: startOfUtcDay(dateKey),
    bookingTime: time,
    $or: [
      booking.serviceId ? { serviceId: booking.serviceId } : null,
      { counselorType: booking.counselorType },
    ].filter(Boolean),
    status: { $in: ['pending', 'confirmed'] },
  });

  if (conflict) {
    return { error: 'The requested time slot is already booked', conflict: true };
  }

  return {
    dateKey,
    time,
    bookingDate: startOfUtcDay(dateKey),
    slotInstant: zonedDateTimeToUtc(dateKey, time, booking.timezone),
  };
};
