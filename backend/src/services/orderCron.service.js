import cron from 'node-cron';
import { expirePendingOrders } from './orderCleanup.service.js';

/**
 * Setup automated cron jobs for the orders / marketplace system.
 */
export const setupOrderCrons = () => {
  console.log('🕐 Setting up order system cron jobs...');

  // Only run crons on primary instance in multi-replica deployments
  const isCronInstance = !process.env.SKIP_CRON_JOBS || process.env.CRON_INSTANCE === 'true';
  if (!isCronInstance) {
    console.log('🕐 Skipping order cron jobs — not the cron instance');
    return;
  }

  // Expire stale pending online orders - Every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const result = await expirePendingOrders();
      if (result.expired > 0) {
        console.log(`⏰ [CRON] Expired ${result.expired} stale pending order(s)`);
      }
    } catch (error) {
      console.error('❌ [CRON] Order expiry failed:', error.message);
    }
  });

  console.log('✅ Order cron jobs scheduled:');
  console.log('   - Expire stale pending orders: Every 10 minutes');
};
