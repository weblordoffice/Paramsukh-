import { Referral } from '../models/referral.models.js';
import { ReferralConfig } from '../models/referralConfig.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { User } from '../models/user.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { upsertActiveUserMembership } from './userMembership.service.js';

/**
 * Checks if a user was referred, verifies if their milestone (completing a course) is met,
 * queries active dynamic reward configurations, and issues referrer rewards.
 */
export const processReferralMilestone = async (referredUserId) => {
  try {
    const referral = await Referral.findOne({ referredUser: referredUserId, status: 'joined' });
    if (!referral) return;

    const completedEnrollment = await Enrollment.findOne({ userId: referredUserId, isCompleted: true });
    if (!completedEnrollment) return;

    let config = await ReferralConfig.findOne({ isActive: true });
    if (!config) {
      config = {
        rewardType: 'premium_extension',
        rewardValue: 15
      };
    }

    const { rewardType, rewardValue } = config;
    const referrerId = referral.referrer;

    if (rewardType === 'premium_extension') {
      const days = parseInt(rewardValue, 10) || 15;
      const existing = await UserMembership.findOne({
        userId: referrerId,
        status: 'active',
        endDate: { $gte: new Date() }
      });

      if (existing) {
        existing.endDate = new Date(existing.endDate.getTime() + days * 24 * 60 * 60 * 1000);
        await existing.save();
        console.log(`➕ Extended active membership of referrer ${referrerId} by ${days} days.`);
      } else {
        const plan = await MembershipPlan.findOne({ slug: { $ne: 'free' } });
        const planSlug = plan ? plan.slug : 'pro';
        
        await upsertActiveUserMembership({
          userId: referrerId,
          planSlug,
          startDate: new Date(),
          endDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
          source: 'admin_grant',
          metadata: { reason: 'Referral reward' }
        });
        console.log(`🎉 Granted new ${planSlug} membership of ${days} days to referrer ${referrerId}.`);
      }
    } 
    else if (rewardType === 'unlock_course') {
      const courseId = String(rewardValue);
      const existingEnrollment = await Enrollment.findOne({ userId: referrerId, courseId });
      if (!existingEnrollment) {
        await Enrollment.create({
          userId: referrerId,
          courseId,
          progress: 0,
          completedVideos: []
        });
        console.log(`🔓 Unlocked course ${courseId} for referrer ${referrerId}.`);
      }
    }

    const referrer = await User.findById(referrerId);
    if (referrer) {
      const alreadyUnlocked = referrer.unlockedBadges.some(b => b.badgeId === 'wellness-guide');
      if (!alreadyUnlocked) {
        referrer.unlockedBadges.push({ badgeId: 'wellness-guide', unlockedAt: new Date() });
        await referrer.save();
        console.log(`🏆 Wellness Guide Badge unlocked for referrer ${referrer.displayName}`);
      }
    }

    referral.status = 'completed';
    referral.rewardApplied = true;
    await referral.save();

    console.log(`✅ Referral milestone reward successfully processed for referee ${referredUserId} and referrer ${referrerId}`);

  } catch (error) {
    console.error('❌ Error processing referral milestone rewards:', error);
  }
};
