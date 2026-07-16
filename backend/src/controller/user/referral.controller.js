import { Referral } from '../../models/referral.models.js';
import { ReferralConfig } from '../../models/referralConfig.models.js';
import { User } from '../../models/user.models.js';
import { generateUniqueReferralCode } from '../../lib/referralHelper.js';

/**
 * Returns referrer's details, dynamic promotion text copies, and list of referred friends
 */
export const getUserReferralDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    let user = req.user;
    if (!user.referralCode) {
      const code = await generateUniqueReferralCode();
      user = await User.findByIdAndUpdate(userId, { referralCode: code }, { new: true });
    }

    const referralsRaw = await Referral.find({ referrer: userId })
      .populate('referredUser', 'displayName createdAt')
      .lean();

    const referrals = referralsRaw.map(ref => ({
      _id: ref._id,
      displayName: ref.referredUser?.displayName || 'Gurukul Learner',
      joinedAt: ref.createdAt,
      status: ref.status
    }));

    let config = await ReferralConfig.findOne({ isActive: true });
    if (!config) {
      config = {
        referrerRewardText: "Get 15 days of Premium Gurukul Access!",
        refereeRewardText: "Start your scientific wellness journey!"
      };
    }

    return res.status(200).json({
      success: true,
      referralCode: user.referralCode,
      referrerRewardText: config.referrerRewardText,
      refereeRewardText: config.refereeRewardText,
      referrals
    });
  } catch (error) {
    console.error('❌ Get user referral dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error loading referral info.',
      error: error.message
    });
  }
};

/**
 * Get active referral config for Admin panel
 */
export const getAdminReferralConfig = async (req, res) => {
  try {
    let config = await ReferralConfig.findOne({ isActive: true });
    if (!config) {
      config = await ReferralConfig.create({
        campaignName: 'Default Launch Promo',
        isActive: true,
        rewardType: 'premium_extension',
        rewardValue: 15,
        referrerRewardText: 'Get 15 days of Premium Gurukul Access!',
        refereeRewardText: 'Start your scientific wellness journey!'
      });
    }

    return res.status(200).json({
      success: true,
      config
    });
  } catch (error) {
    console.error('❌ Get admin config error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error loading configuration.',
      error: error.message
    });
  }
};

/**
 * Create or update referral configuration settings
 */
export const updateAdminReferralConfig = async (req, res) => {
  try {
    const { campaignName, rewardType, rewardValue, referrerRewardText, refereeRewardText, isActive } = req.body;

    let config = await ReferralConfig.findOne({ isActive: true });
    if (!config) {
      config = new ReferralConfig({ isActive: true });
    }

    if (campaignName !== undefined) config.campaignName = campaignName;
    if (rewardType !== undefined) config.rewardType = rewardType;
    if (rewardValue !== undefined) config.rewardValue = rewardValue;
    if (referrerRewardText !== undefined) config.referrerRewardText = referrerRewardText;
    if (refereeRewardText !== undefined) config.refereeRewardText = refereeRewardText;
    if (isActive !== undefined) config.isActive = isActive;

    await config.save();

    return res.status(200).json({
      success: true,
      message: 'Referral configuration updated successfully.',
      config
    });
  } catch (error) {
    console.error('❌ Update admin config error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error updating configuration.',
      error: error.message
    });
  }
};
