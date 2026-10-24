import mongoose from 'mongoose';
import Coupon from '../../models/coupon.models.js';
import CouponUsage from '../../models/couponUsage.models.js';

const discountLabel = (coupon) => {
  if (coupon.discountType === 'percentage') {
    const cap = coupon.maxDiscount ? ` up to ₹${coupon.maxDiscount}` : '';
    return `${coupon.discountValue}% off${cap}`;
  }
  return `₹${coupon.discountValue} off`;
};

/**
 * Coupons personally assigned to the current user.
 * @route GET /api/coupons/mine
 */
export const getMyCoupons = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    const coupons = await Coupon.find({
      isActive: true,
      endDate: { $gte: now },
      applicableUsers: userId,
    })
      .sort({ endDate: 1 })
      .lean();

    if (coupons.length === 0) {
      return res.status(200).json({ success: true, coupons: [] });
    }

    const usageCounts = await CouponUsage.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          coupon: { $in: coupons.map((coupon) => coupon._id) },
        },
      },
      { $group: { _id: '$coupon', count: { $sum: 1 } } },
    ]);
    const usageByCoupon = new Map(usageCounts.map((entry) => [String(entry._id), entry.count]));

    const result = coupons.map((coupon) => {
      const usedCount = usageByCoupon.get(String(coupon._id)) || 0;
      const perUserLimit = coupon.maxUsagePerUser ?? 1;
      const perUserExhausted = usedCount >= perUserLimit;
      const totalExhausted = coupon.maxUsageCount != null
        && coupon.currentUsageCount >= coupon.maxUsageCount;
      const startsInFuture = new Date(coupon.startDate) > now;

      const status = startsInFuture
        ? 'upcoming'
        : (perUserExhausted || totalExhausted ? 'exhausted' : 'active');

      return {
        ...coupon,
        status,
        usedCount,
        remainingUses: Math.max(0, perUserLimit - usedCount),
        discountLabel: discountLabel(coupon),
      };
    });

    return res.status(200).json({ success: true, coupons: result });
  } catch (error) {
    console.error('Get My Coupons Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load coupons',
      error: error.message
    });
  }
};
