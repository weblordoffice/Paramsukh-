import cron from 'node-cron';
import { releaseHeldPoints, expireOldPoints } from './referral.service.js';

/**
 * Setup automated cron jobs for the referral / points system.
 * Releases held points once their hold period elapses and expires
 * points past their configured expiry window.
 */
export const setupReferralCrons = () => {
  console.log('🕐 Setting up referral system cron jobs...');

  // Only run crons on primary instance in multi-replica deployments
  const isCronInstance = !process.env.SKIP_CRON_JOBS || process.env.CRON_INSTANCE === 'true';
  if (!isCronInstance) {
    console.log('🕐 Skipping referral cron jobs — not the cron instance');
    return;
  }

  // Release held points whose hold period has elapsed - Daily at 01:00
  cron.schedule('0 1 * * *', async () => {
    try {
      const released = await releaseHeldPoints();
      if (released > 0) {
        console.log(`✅ [CRON] Released ${released} held referral point transaction(s)`);
      }
    } catch (error) {
      console.error('❌ [CRON] Release held points failed:', error.message);
    }
  });

  // Expire old points past their expiry window - Daily at 01:05
  cron.schedule('5 1 * * *', async () => {
    try {
      const expired = await expireOldPoints();
      if (expired > 0) {
        console.log(`✅ [CRON] Expired ${expired} referral point transaction(s)`);
      }
    } catch (error) {
      console.error('❌ [CRON] Expire old points failed:', error.message);
    }
  });

  console.log('✅ Referral cron jobs scheduled:');
  console.log('   - Release held points: Daily at 01:00');
  console.log('   - Expire old points: Daily at 01:05');
};
