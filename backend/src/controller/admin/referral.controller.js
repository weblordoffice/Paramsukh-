import ReferralConfig from '../../models/referralConfig.models.js';
import ReferralEarningRule from '../../models/referralEarningRule.models.js';
import PointTransaction from '../../models/pointTransaction.models.js';
import { Referral } from '../../models/referral.models.js';

export const getReferralConfig = async (req, res) => {
  try {
    let config = await ReferralConfig.findOne();
    if (!config) config = await ReferralConfig.create({});
    return res.json({ success: true, config });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateReferralConfig = async (req, res) => {
  try {
    const config = await ReferralConfig.findOneAndUpdate(
      {},
      { ...req.body, updatedBy: req.admin?._id },
      { new: true, upsert: true, runValidators: true }
    );
    return res.json({ success: true, config, message: 'Settings updated' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getEarningRules = async (req, res) => {
  try {
    const rules = await ReferralEarningRule.find().sort({ displayOrder: 1 });
    return res.json({ success: true, rules });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createEarningRule = async (req, res) => {
  try {
    const slug = req.body.slug || req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const rule = await ReferralEarningRule.create({ ...req.body, slug });
    return res.status(201).json({ success: true, rule });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: 'Rule slug already exists' });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEarningRule = async (req, res) => {
  try {
    const rule = await ReferralEarningRule.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    return res.json({ success: true, rule });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEarningRule = async (req, res) => {
  try {
    const rule = await ReferralEarningRule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    return res.json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getReferralStats = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalRefs, recentRefs, totalEarnedAgg] = await Promise.all([
      Referral.countDocuments(),
      Referral.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      PointTransaction.aggregate([
        { $match: { type: { $ne: 'redeemed' } } },
        { $group: { _id: null, totalPoints: { $sum: '$points' }, totalValue: { $sum: '$rupeeValue' } } }
      ]),
    ]);

    const topReferrers = await Referral.aggregate([
      { $group: { _id: '$referrer', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 20 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'pointtransactions', let: { uid: '$_id' }, pipeline: [
        { $match: { $expr: { $eq: ['$userId', '$$uid'] }, type: { $ne: 'redeemed' } } },
        { $group: { _id: null, pts: { $sum: '$points' } } }
      ], as: 'pointsData' }},
      { $project: { name: { $ifNull: ['$user.displayName', 'Unknown'] }, count: 1, points: { $ifNull: [{ $arrayElemAt: ['$pointsData.pts', 0] }, 0] } } }
    ]);

    const summary = {
      totalReferrals: totalRefs,
      referralsThisMonth: recentRefs,
      totalPointsEarned: totalEarnedAgg[0]?.totalPoints || 0,
      totalValueEarned: totalEarnedAgg[0]?.totalValue || 0,
    };

    return res.json({ success: true, summary, topReferrers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
