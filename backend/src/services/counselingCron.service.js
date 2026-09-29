import cron from 'node-cron';
import Booking from '../models/booking.models.js';
import { sendNotification } from '../controller/notifications/notifications.controller.js';
import { cleanupExpiredBookings, autoCompletePastBookings } from '../services/bookingCleanup.service.js';

// Configurable reminder thresholds (in hours before booking)
const DEFAULT_REMINDER_THRESHOLDS = [24, 1];

const getReminderThresholds = () => {
  const envValue = process.env.COUNSELING_REMINDER_HOURS;
  if (!envValue) return DEFAULT_REMINDER_THRESHOLDS;
  return envValue.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
};

/**
 * Send booking reminders at configured intervals
 * Cron: Every 30 minutes
 */
const sendBookingReminders = async () => {
  const thresholdsHours = getReminderThresholds();

  for (const hours of thresholdsHours) {
    const now = new Date();
    const targetTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const windowStart = new Date(targetTime.getTime() - 15 * 60 * 1000); // 15 min window
    const windowEnd = new Date(targetTime.getTime() + 15 * 60 * 1000);

    const bookings = await Booking.find({
      status: 'confirmed',
      reminderSentAt: { $exists: false },
      bookingDate: {
        $gte: windowStart,
        $lte: windowEnd
      }
    }).select('_id user bookingTitle bookingDate bookingTime reminderSentAt');

    for (const booking of bookings) {
      try {
        await sendNotification(booking.user, {
          type: 'counseling_reminder',
          title: `Reminder: ${hours}h until your session`,
          message: `Your ${booking.bookingTitle} session is in ${hours} hour(s) at ${booking.bookingTime}`,
          icon: '⏰',
          priority: hours <= 1 ? 'high' : 'medium',
          relatedId: booking._id,
          relatedType: 'booking'
        });

        booking.reminderSentAt = new Date();
        await booking.save();
      } catch (error) {
        console.error(`Failed to send reminder for booking ${booking._id}:`, error.message);
      }
    }
  }
};

/**
 * Setup automated cron jobs for counseling system
 * This runs inside the Node.js app (alternative to external cron)
 */
export const setupCounselingCrons = () => {
  console.log('🕐 Setting up counseling system cron jobs...');

  // Only run crons on primary instance in multi-replica deployments
  const isCronInstance = !process.env.SKIP_CRON_JOBS || process.env.CRON_INSTANCE === 'true';
  if (!isCronInstance) {
    console.log('🕐 Skipping counseling cron jobs — not the cron instance');
    return;
  }

  // Cleanup expired unpaid bookings - Every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('\n⏰ [CRON] Running expired booking cleanup...');
    try {
      const result = await cleanupExpiredBookings();
      console.log(`✅ [CRON] Cleanup complete: ${result.cleaned} bookings cleaned`);
    } catch (error) {
      console.error('❌ [CRON] Cleanup failed:', error.message);
    }
  });

  // Send booking reminders - Every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('\n⏰ [CRON] Running booking reminders...');
    try {
      await sendBookingReminders();
      console.log('✅ [CRON] Reminders sent');
    } catch (error) {
      console.error('❌ [CRON] Reminders failed:', error.message);
    }
  });

  // Auto-complete past bookings - Daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('\n⏰ [CRON] Running auto-completion of past bookings...');
    try {
      const result = await autoCompletePastBookings();
      console.log(`✅ [CRON] Auto-complete complete: ${result.completed} bookings completed`);
    } catch (error) {
      console.error('❌ [CRON] Auto-complete failed:', error.message);
    }
  });

  console.log('✅ Counseling cron jobs scheduled:');
  console.log('   - Cleanup expired: Every 10 minutes');
  console.log('   - Reminders: Every 30 minutes (configurable via COUNSELING_REMINDER_HOURS)');
  console.log('   - Auto-complete: Daily at midnight');
};
