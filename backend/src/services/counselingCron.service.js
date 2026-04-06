import cron from 'node-cron';
import { cleanupExpiredBookings, autoCompletePastBookings } from '../services/bookingCleanup.service.js';

/**
 * Setup automated cron jobs for counseling system
 * This runs inside the Node.js app (alternative to external cron)
 */
export const setupCounselingCrons = () => {
  console.log('🕐 Setting up counseling system cron jobs...');

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
  console.log('   - Auto-complete: Daily at midnight');
};
