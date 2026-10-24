import cron from 'node-cron';
import Booking from '../models/booking.models.js';
import { sendNotification } from '../controller/notifications/notifications.controller.js';
import { cleanupExpiredBookings, autoCompletePastBookings } from '../services/bookingCleanup.service.js';
import { formatInZone, zonedDateTimeToUtc } from '../utils/timezone.js';

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
export const sendBookingReminders = async () => {
  const thresholdsHours = getReminderThresholds()
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  const now = new Date();
  const nowMs = now.getTime();
  const HOUR_MS = 60 * 60 * 1000;

  // Fetch a 3-day window, then compute the exact slot instant per booking.
  const candidates = await Booking.find({
    status: 'confirmed',
    bookingDate: {
      $gte: new Date(nowMs - 24 * HOUR_MS),
      $lte: new Date(nowMs + 48 * HOUR_MS),
    },
    $or: [
      { reminder24SentAt: null },
      { reminder1SentAt: null },
    ],
  }).select('_id user bookingTitle bookingDate bookingTime timezone reminder24SentAt reminder1SentAt');

  for (const booking of candidates) {
    const slotAt = zonedDateTimeToUtc(booking.bookingDate, booking.bookingTime, booking.timezone || 'Asia/Kolkata');
    if (!slotAt) continue;

    const hoursUntil = (slotAt.getTime() - nowMs) / HOUR_MS;
    if (hoursUntil <= 0) continue;

    for (const hours of thresholdsHours.sort((a, b) => a - b)) {
      // 1-hour delivery window per threshold.
      if (hoursUntil > hours || hoursUntil <= hours - 1) continue;

      const field = hours === 1 ? 'reminder1SentAt' : (hours === 24 ? 'reminder24SentAt' : 'reminderSentAt');
      if (booking[field]) continue;

      const claimed = await Booking.findOneAndUpdate(
        { _id: booking._id, [field]: null },
        { $set: { [field]: new Date() } },
        { new: true }
      );
      if (!claimed) continue;

      try {
        await sendNotification(booking.user, {
          type: 'counseling_reminder',
          title: `Reminder: ${hours}h until your session`,
          message: `Your ${booking.bookingTitle} session is in ${hours} hour(s) at ${formatInZone(slotAt, booking.timezone || 'Asia/Kolkata')}.`,
          icon: '⏰',
          priority: hours <= 1 ? 'high' : 'medium',
          relatedId: booking._id,
          relatedType: 'booking',
          actionUrl: `/counseling-detail?bookingId=${booking._id}`
        });

        booking[field] = new Date();
      } catch (error) {
        await Booking.updateOne({ _id: booking._id }, { $set: { [field]: null } });
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
