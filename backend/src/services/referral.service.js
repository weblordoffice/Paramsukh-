import ReferralConfig from '../models/referralConfig.models.js';
import ReferralEarningRule from '../models/referralEarningRule.models.js';
import PointTransaction from '../models/pointTransaction.models.js';
import { User } from '../models/user.models.js';
import { Referral } from '../models/referral.models.js';

export const fireTrigger = async (triggerEvent, { referrerId, referredUserId, amount = 0, source = '', metadata = {} }) => {
  try {
    const config = await ReferralConfig.findOne();
    if (!config || !config.isActive) return [];

    const rules = await ReferralEarningRule.find({ triggerEvent, isActive: true }).sort({ displayOrder: 1 });
    if (!rules.length) return [];

    const referrer = await User.findById(referrerId);
    if (!referrer) return [];

    const accountAgeHours = (Date.now() - new Date(referrer.createdAt).getTime()) / (60 * 60 * 1000);
    if (config.minReferrerAccountAgeDays && accountAgeHours < config.minReferrerAccountAgeDays * 24) return [];

    const awarded = [];
    for (const rule of rules) {
      if (rule.minReferrerAccountAgeHours > 0 && accountAgeHours < rule.minReferrerAccountAgeHours) continue;

      if (rule.cooldownPerUser > 0) {
        const count = await PointTransaction.countDocuments({ userId: referrerId, referredUserId, ruleId: rule._id });
        if (count >= rule.cooldownPerUser) continue;
      }

      if (config.maxPointsPerReferrerTotal > 0) {
        if ((referrer.totalPointsEarned || 0) + rule.pointsValue > config.maxPointsPerReferrerTotal) continue;
      }

      const expiresAt = config.pointsExpireMonths > 0
        ? new Date(Date.now() + config.pointsExpireMonths * 30 * 24 * 60 * 60 * 1000)
        : null;

      const holdUntil = rule.holdDays > 0
        ? new Date(Date.now() + rule.holdDays * 24 * 60 * 60 * 1000)
        : null;

      const tx = await PointTransaction.create({
        userId: referrerId,
        referredUserId,
        ruleId: rule._id,
        type: triggerEvent,
        points: rule.pointsValue,
        balance: (referrer.referralPoints || 0) + rule.pointsValue,
        pointValue: config.pointValueInRupees,
        rupeeValue: rule.pointsValue * config.pointValueInRupees,
        status: holdUntil ? 'held' : 'active',
        holdUntil,
        expiresAt,
        metadata,
      });

      referrer.referralPoints = (referrer.referralPoints || 0) + rule.pointsValue;
      referrer.totalPointsEarned = (referrer.totalPointsEarned || 0) + rule.pointsValue;
      await referrer.save();

      awarded.push({ rule: rule.name, points: rule.pointsValue, txId: tx._id.toString() });
    }

    if (awarded.length > 0 && config.notifyOnEarn) {
      try {
        const Notification = (await import('../models/notification.models.js')).default;
        const totalPoints = awarded.reduce((s, a) => s + a.points, 0);
        await Notification.create({
          user: referrerId,
          type: 'referral_earn',
          title: 'Points Earned!',
          body: `You earned ${totalPoints} referral points!`,
          data: { awarded, triggerEvent },
          isRead: false,
        });
      } catch (_) {}
    }

    return awarded;
  } catch (error) {
    console.error('fireTrigger error:', error.message);
    return [];
  }
};

export const releaseHeldPoints = async () => {
  const now = new Date();
  const held = await PointTransaction.find({ status: 'held', holdUntil: { $lte: now } });
  for (const tx of held) {
    tx.status = 'active';
    await tx.save();
  }
  return held.length;
};

export const expireOldPoints = async () => {
  const now = new Date();
  const expired = await PointTransaction.find({ status: 'active', expiresAt: { $lte: now, $ne: null } });
  for (const tx of expired) {
    const user = await User.findById(tx.userId);
    if (user) {
      user.referralPoints = Math.max(0, (user.referralPoints || 0) - tx.points);
      await user.save();
    }
    tx.status = 'expired';
    await tx.save();
  }
  return expired.length;
};

export const redeemPoints = async (userId, points, orderId) => {
  const config = await ReferralConfig.findOne();
  if (!config || !config.isActive) return { success: false, message: 'Referral system is inactive' };

  if (points < config.minRedemptionPoints) {
    return { success: false, message: `Minimum ${config.minRedemptionPoints} points required` };
  }

  const user = await User.findById(userId);
  if (!user || (user.referralPoints || 0) < points) {
    return { success: false, message: 'Insufficient points' };
  }

  const tx = await PointTransaction.create({
    userId,
    type: 'redeemed',
    points: -points,
    balance: user.referralPoints - points,
    pointValue: config.pointValueInRupees,
    rupeeValue: points * config.pointValueInRupees,
    status: 'redeemed',
    redeemedIn: orderId,
  });

  user.referralPoints -= points;
  await user.save();

  return { success: true, points, discount: points * config.pointValueInRupees, transactionId: tx._id };
};

export const getReferralValidation = async (code, newUserId, ip) => {
  const config = await ReferralConfig.findOne();
  if (!config || !config.isActive) return { valid: false, reason: 'Referrals are currently disabled' };

  const referrer = await User.findOne({ referralCode: code.trim() });
  if (!referrer) return { valid: false, reason: 'Invalid referral code' };
  if (String(referrer._id) === String(newUserId)) return { valid: false, reason: 'Cannot refer yourself' };

  const existing = await Referral.findOne({ referredUser: newUserId });
  if (existing) return { valid: false, reason: 'Already referred by someone' };

  const accountAgeHours = (Date.now() - new Date(referrer.createdAt).getTime()) / (60 * 60 * 60 * 1000);
  if (config.minReferrerAccountAgeDays && accountAgeHours < config.minReferrerAccountAgeDays * 24) {
    return { valid: false, reason: 'Referrer account too new' };
  }

  if (ip && config.maxReferralsPerIP24h) {
    const count = await Referral.countDocuments({
      referrer: referrer._id,
      'metadata.ip': ip,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (count >= config.maxReferralsPerIP24h) {
      return { valid: false, reason: 'Too many referrals from this network' };
    }
  }

  return { valid: true, referrer };
};
