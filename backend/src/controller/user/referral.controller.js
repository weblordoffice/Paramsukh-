import { User } from '../../models/user.models.js';
import { Referral } from '../../models/referral.models.js';
import ReferralConfig from '../../models/referralConfig.models.js';
import ReferralEarningRule from '../../models/referralEarningRule.models.js';
import PointTransaction from '../../models/pointTransaction.models.js';
import { generateUniqueReferralCode } from '../../lib/referralHelper.js';
import { redeemPoints, getReferralValidation } from '../../services/referral.service.js';

export const getUserReferralDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let user = req.user;
    if (!user.referralCode) {
      const code = await generateUniqueReferralCode(user.displayName);
      user = await User.findByIdAndUpdate(userId, { referralCode: code }, { new: true });
    }

    const config = await ReferralConfig.findOne();

    const [referrals, total, pointTxns, totalEarnedAgg] = await Promise.all([
      Referral.find({ referrer: userId })
        .populate('referredUser', 'displayName createdAt')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Referral.countDocuments({ referrer: userId }),
      PointTransaction.find({ userId, type: { $in: ['user.signup', 'user.first_purchase', 'user.course_complete', 'user.monthly_active'] } })
        .sort({ createdAt: -1 }).limit(20).lean(),
      PointTransaction.aggregate([
        { $match: { userId, status: { $in: ['active', 'redeemed'] } } },
        { $group: { _id: null, total: { $sum: '$rupeeValue' } } }
      ]),
    ]);

    return res.status(200).json({
      success: true,
      referralCode: user.referralCode,
      points: user.referralPoints || 0,
      totalPointsEarned: user.totalPointsEarned || 0,
      lifetimeValue: totalEarnedAgg[0]?.total || 0,
      pointValue: config ? config.pointValueInRupees : 1,
      referrals: referrals.map(r => ({
        _id: r._id,
        displayName: r.referredUser?.displayName || 'Member',
        joinedAt: r.createdAt,
      })),
      recentActivity: pointTxns.map(t => ({
        type: t.type,
        points: t.points,
        rupeeValue: t.rupeeValue,
        createdAt: t.createdAt,
        description: t.metadata?.description || '',
      })),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Referral dashboard error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPointsHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [txns, total] = await Promise.all([
      PointTransaction.find({ userId: req.user._id })
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      PointTransaction.countDocuments({ userId: req.user._id }),
    ]);

    return res.json({
      success: true,
      data: txns,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const handleRedeemPoints = async (req, res) => {
  try {
    const { points, orderId } = req.body;
    if (!points || points <= 0) return res.status(400).json({ success: false, message: 'Points required' });

    const result = await redeemPoints(req.user._id, parseInt(points), orderId);
    if (!result.success) return res.status(400).json({ success: false, message: result.message });

    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const regenerateReferralCode = async (req, res) => {
  try {
    const code = await generateUniqueReferralCode(req.user.displayName);
    await User.findByIdAndUpdate(req.user._id, { referralCode: code });
    return res.json({ success: true, referralCode: code });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const applyReferralCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code required' });

    const normalizedCode = code.trim().toUpperCase();
    const validation = await getReferralValidation(code, req.user._id, req.ip);
    if (!validation.valid) return res.status(400).json({ success: false, message: validation.reason });

    // Link the referral; if the Referral row fails to create, revert referredBy so we
    // never end up with an inconsistent state (referredBy set but no Referral record).
    try {
      await User.findByIdAndUpdate(req.user._id, { referredBy: validation.referrer._id });
      await Referral.create({
        referrer: validation.referrer._id,
        referredUser: req.user._id,
        referralCode: normalizedCode,
        metadata: { ip: req.ip, userAgent: req.headers['user-agent'] || '', channel: 'app' },
      });
    } catch (err) {
      await User.findByIdAndUpdate(req.user._id, { referredBy: null });
      if (err.code === 11000) return res.status(400).json({ success: false, message: 'Already referred' });
      throw err;
    }

    const { fireTrigger } = await import('../../services/referral.service.js');
    await fireTrigger('user.signup', { referrerId: validation.referrer._id, referredUserId: req.user._id });

    return res.json({ success: true, message: 'Referral code applied!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
