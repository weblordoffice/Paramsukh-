import Booking from '../models/booking.models.js';
import { sendNotification } from '../controller/notifications/notifications.controller.js';
import {
  releaseBookingSlot,
  revertDiscountForBooking,
} from './counselingBooking.service.js';
import { zonedDateTimeToUtc } from '../utils/timezone.js';

const BATCH_SIZE = 50;

function resolveBookingDateTime(booking) {
  return zonedDateTimeToUtc(
    booking.bookingDate,
    booking.bookingTime,
    booking.timezone || 'Asia/Kolkata'
  ) || new Date(booking.bookingDate);
}

/**
 * Cancel unpaid/promoted-expired bookings, release their slots, revert the
 * discount ledger, and promote the next waitlisted user.
 */
export const cleanupExpiredBookings = async () => {
  try {
    console.log('🧹 Starting cleanup of expired unpaid bookings...');

    const DEFAULT_TIMEOUT_MINUTES = 30;
    const now = new Date();
    const timeoutThreshold = new Date(now.getTime() - DEFAULT_TIMEOUT_MINUTES * 60 * 1000);

    const expiredBookings = await Booking.find({
      status: 'pending',
      isFree: false,
      $or: [
        {
          paymentStatus: { $in: ['pending', 'failed'] },
          createdAt: { $lt: timeoutThreshold },
        },
        { paymentDueAt: { $ne: null, $lt: now } },
      ],
    }).limit(BATCH_SIZE);

    if (expiredBookings.length === 0) {
      console.log('✅ No expired bookings to clean up');
      return { success: true, cleaned: 0 };
    }

    console.log(`🗑️ Found ${expiredBookings.length} expired bookings to cancel (batch size: ${BATCH_SIZE})`);

    let cleanedCount = 0;
    for (const booking of expiredBookings) {
      try {
        const cancelled = await Booking.findOneAndUpdate(
          { _id: booking._id, status: 'pending' },
          {
            $set: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancellationReason: 'Payment timeout - booking automatically cancelled',
              cancelledBy: 'system',
              paymentStatus: booking.paymentStatus === 'paid' ? 'paid' : 'failed',
              paymentDueAt: null,
            }
          },
          { new: true }
        );

        if (!cancelled) continue;

        await releaseBookingSlot(cancelled);
        await revertDiscountForBooking(cancelled);

        try {
          await sendNotification(cancelled.user, {
            type: 'counseling_cancelled',
            title: 'Booking Cancelled - Payment Timeout',
            message: `Your booking for ${cancelled.bookingTitle} was cancelled due to payment timeout.`,
            icon: '⏰',
            priority: 'medium',
            relatedId: cancelled._id,
            relatedType: 'booking',
            actionUrl: `/counseling-detail?bookingId=${cancelled._id}`
          });
        } catch (error) {
          console.error(`⚠️ Failed to send notification for booking ${cancelled._id}:`, error.message);
        }

        cleanedCount++;
      } catch (error) {
        console.error(`⚠️ Failed to cancel booking ${booking._id}:`, error.message);
      }
    }

    console.log(`✅ Successfully cleaned ${cleanedCount} expired bookings`);
    return { success: true, cleaned: cleanedCount };
  } catch (error) {
    console.error('❌ Error cleaning up expired bookings:', error);
    throw error;
  }
};

/**
 * Auto-complete past bookings based on the session end in the service timezone.
 */
export const autoCompletePastBookings = async () => {
  try {
    console.log('📅 Starting auto-completion of past bookings...');

    const now = new Date();
    const BATCH_COMPLETE_SIZE = 100;

    let completedCount = 0;
    let hasMore = true;

    while (hasMore) {
      const pastBookings = await Booking.find({
        status: 'confirmed',
        paymentStatus: { $in: ['paid', 'not_required'] },
        bookingDate: { $lt: new Date(now.getTime() + 24 * 60 * 60 * 1000) }
      }).select('_id bookingDate bookingTime timezone duration').limit(BATCH_COMPLETE_SIZE);

      if (pastBookings.length === 0) {
        hasMore = false;
        break;
      }

      const eligibleIds = [];
      for (const booking of pastBookings) {
        const start = resolveBookingDateTime(booking);
        const end = new Date(start.getTime() + (Number(booking.duration) || 60) * 60 * 1000);
        if (end < now) {
          eligibleIds.push(booking._id);
        }
      }

      if (eligibleIds.length === 0) {
        hasMore = false;
        break;
      }

      const result = await Booking.updateMany(
        { _id: { $in: eligibleIds } },
        {
          status: 'completed',
          completedAt: new Date()
        }
      );

      completedCount += result.modifiedCount;

      if (pastBookings.length < BATCH_COMPLETE_SIZE) {
        hasMore = false;
      }
    }

    console.log(`✅ Auto-completed ${completedCount} past bookings`);
    return { success: true, completed: completedCount };
  } catch (error) {
    console.error('❌ Error auto-completing past bookings:', error);
    throw error;
  }
};
