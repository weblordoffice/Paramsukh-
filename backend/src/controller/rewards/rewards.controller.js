import { Reward, PointHistory, UserReward } from '../../models/reward.models.js';
import { User } from '../../models/user.models.js';

// @desc    Get all available rewards (Catalog)
// @route   GET /api/rewards/catalog
// @access  Public
export const getRewardsCatalog = async (req, res) => {
    try {
        const rewards = await Reward.find({ isAvailable: true }).sort('pointsCost');
        res.status(200).json({
            success: true,
            data: rewards
        });
    } catch (error) {
        console.error('Get Rewards Catalog Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch rewards catalog'
        });
    }
};

// @desc    Get user's point history and status
// @route   GET /api/rewards/my-status
// @access  Private
export const getUserRewardsStatus = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get User Total Points
        const user = await User.findById(userId).select('gamification');

        // Get Recent History
        const history = await PointHistory.find({ userId })
            .sort({ createdAt: -1 })
            .limit(20);

        // Get Redeemed Rewards
        const redeemed = await UserReward.find({ userId })
            .populate('rewardId')
            .sort({ redeemedAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                totalPoints: user.gamification?.totalPoints || 0,
                currentLevel: user.gamification?.currentLevel || 'Beginner',
                history,
                redeemed
            }
        });
    } catch (error) {
        console.error('Get User Rewards Status Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch rewards status'
        });
    }
};

// @desc    Redeem a reward
// @route   POST /api/rewards/redeem/:rewardId
// @access  Private
export const redeemReward = async (req, res) => {
    try {
        const { rewardId } = req.params;
        const userId = req.user._id;

        const reward = await Reward.findById(rewardId);
        if (!reward) {
            return res.status(404).json({ success: false, message: 'Reward not found' });
        }

        const user = await User.findById(userId);
        const currentPoints = user.gamification?.totalPoints || 0;

        if (currentPoints < reward.pointsCost) {
            return res.status(400).json({
                success: false,
                message: `Insufficient points. You need ${reward.pointsCost - currentPoints} more points.`
            });
        }

        // Deduct points
        user.gamification.totalPoints -= reward.pointsCost;
        await user.save();

        // Create Redemption Record
        const userReward = await UserReward.create({
            userId,
            rewardId,
            status: 'active'
        });

        // Log History
        await PointHistory.create({
            userId,
            activity: `Redeemed: ${reward.title}`,
            points: -reward.pointsCost,
            type: 'redeem'
        });

        res.status(200).json({
            success: true,
            message: `Successfully redeemed ${reward.title}`,
            data: userReward
        });

    } catch (error) {
        console.error('Redeem Reward Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to redeem reward'
        });
    }
};

// @desc    Admin: Create a new reward item
// @route   POST /api/rewards/create
// @access  Admin
export const createReward = async (req, res) => {
    try {
        const { title, description, pointsCost, emoji, color, category } = req.body;

        const reward = await Reward.create({
            title,
            description,
            pointsCost,
            emoji,
            color,
            category
        });

        res.status(201).json({
            success: true,
            data: reward
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Internal Helper: Add points to user
export const addPointsToUser = async (userId, points, activity, metadata = {}) => {
    try {
        const user = await User.findById(userId);
        if (!user) return false;

        // Init gamification if missing
        if (!user.gamification) {
            user.gamification = { totalPoints: 0, currentLevel: 'Beginner', badges: [] };
        }

        user.gamification.totalPoints += points;

        // Simple Level Logic
        if (user.gamification.totalPoints > 1000) user.gamification.currentLevel = 'Guru';
        else if (user.gamification.totalPoints > 500) user.gamification.currentLevel = 'Master';
        else if (user.gamification.totalPoints > 200) user.gamification.currentLevel = 'Advanced';
        else if (user.gamification.totalPoints > 100) user.gamification.currentLevel = 'Intermediate';

        await user.save();

        await PointHistory.create({
            userId,
            points,
            activity,
            type: 'earn',
            metadata
        });

        return true;
    } catch (error) {
        console.error('Add Points Error:', error);
        return false;
    }
};
