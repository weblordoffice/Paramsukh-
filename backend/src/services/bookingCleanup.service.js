import Booking from '../models/booking.models.js';
import { sendNotification } from '../controller/notifications/notifications.controller.js';

const BATCH_SIZE = 50;

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
 * Uses aggregation pipeline to avoid loading all bookings into memory
 */
export const cleanupExpiredBookings = async () => {
  try {
    console.log('🧹 Starting cleanup of expired unpaid bookings...');

    const DEFAULT_TIMEOUT_MINUTES = 30;
    const timeoutThreshold = new Date(Date.now() - DEFAULT_TIMEOUT_MINUTES * 60 * 1000);

    // Use aggregation to find expired bookings efficiently without loading all into memory
    const expiredPipeline = [
      {
        $match: {
          status: 'pending',
          paymentStatus: 'pending',
          isFree: false
        }
      },
      {
        $addFields: {
          linkExpiryDate: { $ifNull: ['$paymentLinkExpiresAt', null] }
        }
      },
      {
        $match: {
          $or: [
            {
              linkExpiryDate: null,
              createdAt: { $lt: timeoutThreshold }
            },
            {
              linkExpiryDate: { $ne: null, $lt: timeoutThreshold }
            }
          ]
        }
      },
      {
        $project: {
          _id: 1,
          user: 1,
          bookingTitle: 1,
          bookingDate: 1,
          bookingTime: 1
        }
      },
      {
        $limit: BATCH_SIZE
      }
    ];

    const expiredBookings = await Booking.aggregate(expiredPipeline);

    if (expiredBookings.length === 0) {
      console.log('✅ No expired bookings to clean up');
      return { success: true, cleaned: 0 };
    }

    console.log(`🗑️ Found ${expiredBookings.length} expired bookings to cancel (batch size: ${BATCH_SIZE})`);

    let cleanedCount = 0;
    for (const bookingData of expiredBookings) {
      try {
        await Booking.findByIdAndUpdate(bookingData._id, {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: 'Payment timeout - booking automatically cancelled',
          cancelledBy: 'system'
        });

        try {
          await sendNotification(bookingData.user, {
            type: 'counseling_cancelled',
            title: 'Booking Cancelled - Payment Timeout',
            message: `Your booking for ${bookingData.bookingTitle} on ${new Date(bookingData.bookingDate).toLocaleDateString()} was cancelled due to payment timeout.`,
            icon: '⏰',
            priority: 'medium',
            relatedId: bookingData._id,
            relatedType: 'booking'
          });
        } catch (error) {
          console.error(`⚠️ Failed to send notification for booking ${bookingData._id}:`, error.message);
        }

        cleanedCount++;
      } catch (error) {
        console.error(`⚠️ Failed to cancel booking ${bookingData._id}:`, error.message);
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
 * Auto-complete past bookings that haven't been marked as completed
 * Run this daily at midnight
 * Uses streaming aggregation to avoid memory issues with large datasets
 */
export const autoCompletePastBookings = async () => {
  try {
    console.log('📅 Starting auto-completion of past bookings...');

    const now = new Date();
    const BATCH_COMPLETE_SIZE = 100;

    let completedCount = 0;
    let hasMore = true;

    while (hasMore) {
      // Query only confirmed bookings that might be past
      // Add buffer: booking is past if bookingDate + bookingTime < now
      const pastBookings = await Booking.find({
        status: 'confirmed',
        paymentStatus: { $in: ['paid', 'not_required'] },
        bookingDate: { $lt: now }
      }).select('_id').limit(BATCH_COMPLETE_SIZE);

      if (pastBookings.length === 0) {
        hasMore = false;
        break;
      }

      const eligibleIds = [];
      for (const booking of pastBookings) {
        const bookingDateTime = resolveBookingDateTime(booking.bookingDate, booking.bookingTime);
        if (bookingDateTime < now) {
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
