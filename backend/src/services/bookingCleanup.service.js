import Booking from '../models/booking.models.js';
import { sendNotification } from '../controller/notifications/notifications.controller.js';

function resolveBookingDateTime(bookingDate, bookingTime) {
  const date = new Date(bookingDate);
  if (!bookingTime) return date;
  const match = String(bookingTime).match(/^(\d{1,2}):(\d{2})$/);
  if (match) date.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
  return date;
}

/**
 * Cleanup unpaid bookings that have exceeded the payment timeout
 * Run this every 5-10 minutes via cron job
 */
export const cleanupExpiredBookings = async () => {
  try {
    console.log('🧹 Starting cleanup of expired unpaid bookings...');

    const DEFAULT_TIMEOUT_MINUTES = 30;
    const timeoutThreshold = new Date(Date.now() - DEFAULT_TIMEOUT_MINUTES * 60 * 1000);

    const allPending = await Booking.find({
      status: 'pending',
      paymentStatus: 'pending',
      isFree: false,
    });

    // Only cancel if timeout has passed AND payment link has expired (if exists)
    const expiredBookings = allPending.filter(booking => {
      const linkExpiry = booking.paymentLinkExpiresAt ? new Date(booking.paymentLinkExpiresAt) : null;
      const threshold = linkExpiry && linkExpiry > timeoutThreshold ? linkExpiry : timeoutThreshold;
      return new Date(booking.createdAt) < threshold;
    });

    if (expiredBookings.length === 0) {
      console.log('✅ No expired bookings to clean up');
      return { success: true, cleaned: 0 };
    }

    console.log(`🗑️ Found ${expiredBookings.length} expired bookings to cancel`);

    let cleanedCount = 0;
    for (const booking of expiredBookings) {
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancellationReason = 'Payment timeout - booking automatically cancelled';
      booking.cancelledBy = 'system';
      await booking.save();

      try {
        await sendNotification(booking.user, {
          type: 'counseling_cancelled',
          title: 'Booking Cancelled - Payment Timeout',
          message: `Your booking for ${booking.bookingTitle} on ${new Date(booking.bookingDate).toLocaleDateString()} was cancelled due to payment timeout.`,
          icon: '⏰',
          priority: 'medium',
          relatedId: booking._id,
          relatedType: 'booking'
        });
      } catch (error) {
        console.error(`⚠️ Failed to send notification for booking ${booking._id}:`, error.message);
      }

      cleanedCount++;
    }

    console.log(`✅ Successfully cleaned ${cleanedCount} expired bookings`);
    return { success: true, cleaned: cleanedCount };
  } catch (error) {
    console.error('❌ Error cleaning up expired bookings:', error);
    throw error;
  }
};

/**
 * Auto-complete past bookings that haven't been marked as completed
 * Run this daily at midnight
 */
export const autoCompletePastBookings = async () => {
  try {
    console.log('📅 Starting auto-completion of past bookings...');

    const now = new Date();
    const pastBookings = await Booking.find({
      status: 'confirmed',
      paymentStatus: { $in: ['paid', 'not_required'] }
    });

    // Filter: only complete if the full datetime (bookingDate + bookingTime) is in the past
    const eligible = pastBookings.filter(b => resolveBookingDateTime(b.bookingDate, b.bookingTime) < now);

    if (eligible.length === 0) {
      console.log('✅ No past bookings to auto-complete');
      return { success: true, completed: 0 };
    }

    console.log(`✅ Found ${eligible.length} past bookings to mark as completed`);

    let completedCount = 0;
    for (const booking of eligible) {
      booking.status = 'completed';
      booking.completedAt = new Date();
      await booking.save();
      completedCount++;
    }

    console.log(`✅ Successfully auto-completed ${completedCount} bookings`);
    return { success: true, completed: completedCount };
  } catch (error) {
    console.error('❌ Error auto-completing past bookings:', error);
    throw error;
  }
};
