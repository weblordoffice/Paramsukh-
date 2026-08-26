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

      // Atomic, cap-aware increment so concurrent triggers can't exceed the total cap
      const capFilter = config.maxPointsPerReferrerTotal > 0
        ? { _id: referrerId, totalPointsEarned: { $lte: config.maxPointsPerReferrerTotal - rule.pointsValue } }
        : { _id: referrerId };
      const updatedReferrer = await User.findOneAndUpdate(
        capFilter,
        { $inc: { referralPoints: rule.pointsValue, totalPointsEarned: rule.pointsValue } },
        { new: true }
      );
      if (!updatedReferrer) continue; // total cap reached for this rule

      const expiresAt = config.pointsExpireMonths > 0
        ? new Date(Date.now() + config.pointsExpireMonths * 30 * 24 * 60 * 60 * 1000)
        : null;

      // Honor per-rule holdDays, falling back to the global purchase hold for first purchases
      const holdDays = rule.holdDays > 0
        ? rule.holdDays
        : (triggerEvent === 'user.first_purchase' ? (config.purchasePointsHoldDays || 0) : 0);
      const holdUntil = holdDays > 0
        ? new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000)
        : null;

      const tx = await PointTransaction.create({
        userId: referrerId,
        referredUserId,
        ruleId: rule._id,
        type: triggerEvent,
        points: rule.pointsValue,
        balance: updatedReferrer.referralPoints,
        pointValue: config.pointValueInRupees,
        rupeeValue: rule.pointsValue * config.pointValueInRupees,
        status: holdUntil ? 'held' : 'active',
        holdUntil,
        expiresAt,
        metadata,
      });

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
  let released = 0;
  for (const tx of held) {
    try {
      tx.status = 'active';
      await tx.save();
      released++;
    } catch (err) {
      console.error('❌ Failed to release held points tx', tx._id?.toString(), err.message);
    }
  }
  return released;
};

export const expireOldPoints = async () => {
  const now = new Date();
  const expired = await PointTransaction.find({ status: 'active', expiresAt: { $lte: now, $ne: null } });
  let expiredCount = 0;
  for (const tx of expired) {
    try {
      const user = await User.findById(tx.userId);
      if (user) {
        user.referralPoints = Math.max(0, (user.referralPoints || 0) - tx.points);
        await user.save();
      }
      tx.status = 'expired';
      await tx.save();
      expiredCount++;
    } catch (err) {
      console.error('❌ Failed to expire points tx', tx._id?.toString(), err.message);
    }
  }
  return expiredCount;
};

export const redeemPoints = async (userId, points, orderId) => {
  const config = await ReferralConfig.findOne();
  if (!config || !config.isActive) return { success: false, message: 'Referral system is inactive' };

  if (points < config.minRedemptionPoints) {
    return { success: false, message: `Minimum ${config.minRedemptionPoints} points required` };
  }

  // Atomic conditional decrement: only succeeds if the user actually has >= points,
  // preventing negative balances from concurrent redemptions.
  const user = await User.findOneAndUpdate(
    { _id: userId, referralPoints: { $gte: points } },
    { $inc: { referralPoints: -points } },
    { new: true }
  );
  if (!user) return { success: false, message: 'Insufficient points' };

  const tx = await PointTransaction.create({
    userId,
    type: 'redeemed',
    points: -points,
    balance: user.referralPoints,
    pointValue: config.pointValueInRupees,
    rupeeValue: points * config.pointValueInRupees,
    status: 'redeemed',
    redeemedIn: orderId,
  });

  return { success: true, points, discount: points * config.pointValueInRupees, transactionId: tx._id };
};

export const getReferralValidation = async (code, newUserId, ip) => {
  const normalizedCode = (code || '').trim().toUpperCase();

  const config = await ReferralConfig.findOne();
  if (!config || !config.isActive) return { valid: false, reason: 'Referrals are currently disabled' };

  const referrer = await User.findOne({ referralCode: normalizedCode });
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
