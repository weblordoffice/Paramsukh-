import Booking from '../models/booking.models.js';
import { sendNotification } from '../controller/notifications/notifications.controller.js';

/**
 * Cleanup unpaid bookings that have exceeded the payment timeout
 * Run this every 5-10 minutes via cron job
 */
export const cleanupExpiredBookings = async () => {
  try {
    console.log('🧹 Starting cleanup of expired unpaid bookings...');

    // Find bookings that are pending payment for more than 30 minutes
    const PAYMENT_TIMEOUT_MINUTES = 30;
    const timeoutThreshold = new Date(Date.now() - PAYMENT_TIMEOUT_MINUTES * 60 * 1000);

    const expiredBookings = await Booking.find({
      status: 'pending',
      paymentStatus: 'pending',
      isFree: false,
      createdAt: { $lt: timeoutThreshold }
    });

    if (expiredBookings.length === 0) {
      console.log('✅ No expired bookings to clean up');
      return { success: true, cleaned: 0 };
    }

    console.log(`🗑️ Found ${expiredBookings.length} expired bookings to cancel`);

    let cleanedCount = 0;

    for (const booking of expiredBookings) {
      // Cancel the booking
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancellationReason = 'Payment timeout - booking automatically cancelled after 30 minutes';
      booking.cancelledBy = 'system';
      await booking.save();

      // Notify user
      try {
        await sendNotification(booking.user, {
          type: 'booking_status',
          title: 'Booking Cancelled - Payment Timeout',
          message: `Your booking for ${booking.bookingTitle} on ${new Date(booking.bookingDate).toLocaleDateString()} was cancelled due to payment timeout. Please book again if needed.`,
          icon: '⏰',
          priority: 'medium',
          relatedId: booking._id,
          relatedType: 'booking'
        });
      } catch (error) {
        console.error(`Failed to send notification for booking ${booking._id}:`, error.message);
      }

      cleanedCount++;
    }

    console.log(`✅ Successfully cleaned ${cleanedCount} expired bookings`);

    return {
      success: true,
      cleaned: cleanedCount,
      total: expiredBookings.length
    };
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

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(23, 59, 59, 999);

    const pastBookings = await Booking.find({
      status: 'confirmed',
      bookingDate: { $lt: yesterday },
      paymentStatus: { $in: ['paid', 'not_required'] }
    });

    if (pastBookings.length === 0) {
      console.log('✅ No past bookings to auto-complete');
      return { success: true, completed: 0 };
    }

    console.log(`✅ Found ${pastBookings.length} past bookings to mark as completed`);

    let completedCount = 0;

    for (const booking of pastBookings) {
      booking.status = 'completed';
      booking.completedAt = new Date();
      await booking.save();

      completedCount++;
    }

    console.log(`✅ Successfully auto-completed ${completedCount} bookings`);

    return {
      success: true,
      completed: completedCount,
      total: pastBookings.length
    };
  } catch (error) {
    console.error('❌ Error auto-completing past bookings:', error);
    throw error;
  }
};
