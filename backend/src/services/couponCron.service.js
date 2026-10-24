import cron from 'node-cron';
import Coupon from '../models/coupon.models.js';
import { notifyCouponRecipients } from './couponNotification.service.js';

const pendingRecipientsQuery = {
  $expr: {
    $gt: [
      { $size: { $setDifference: ['$applicableUsers', { $ifNull: ['$notifiedUsers', []] }] } },
      0,
    ],
  },
};

/**
 * Announce any active, personalized coupon that still has users who were never
 * notified. Covers coupons scheduled to start in the future.
 */
export const processPendingCouponNotifications = async () => {
  const now = new Date();
  const coupons = await Coupon.find({
    isActive: true,
    userRestriction: 'specific',
    startDate: { $lte: now },
    endDate: { $gte: now },
    'applicableUsers.0': { $exists: true },
    ...pendingRecipientsQuery,
  });

  let notified = 0;
  for (const coupon of coupons) {
    try {
      const result = await notifyCouponRecipients(coupon);
      notified += result.notified;
    } catch (error) {
      console.error(`[CRON] Coupon notification failed for ${coupon.code}:`, error?.message);
    }
  }

  return { notified };
};

export const setupCouponCrons = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await processPendingCouponNotifications();
      if (result.notified > 0) {
        console.log(`[CRON] Coupon notifications sent: ${result.notified}`);
      }
    } catch (error) {
      console.error('[CRON] Coupon notifications failed:', error.message);
    }
  });

  console.log('[CRON] Coupon notifications scheduled every 15 minutes');
};
