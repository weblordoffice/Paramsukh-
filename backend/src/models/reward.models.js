import mongoose from 'mongoose';

// Schema for Point History (Earning & Spending)
const pointHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    activity: {
        type: String, // e.g., "Completed Course: PHP Basics", "Daily Login"
        required: true
    },
    points: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['earn', 'redeem', 'adjustment'],
        default: 'earn'
    },
    metadata: {
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
        orderId: { type: String } // For referrals or purchases
    }
}, {
    timestamps: true
});

// Schema for Rewards/Badges Catalog
const rewardSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    pointsCost: {
        type: Number,
        required: true
    },
    emoji: {
        type: String,
        default: '🏆'
    },
    color: {
        type: String,
        default: '#F59E0B' // Amber/Gold default
    },
    bgColor: {
        type: String,
        default: '#FEF3C7'
    },
    category: {
        type: String,
        enum: ['Badge', 'Gift', 'Benefit'],
        default: 'Badge'
    },
    isAvailable: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Schema for User's Redeemed Rewards
const userRewardSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    rewardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Reward',
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'used', 'expired'],
        default: 'active'
    },
    redeemedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create Indexes
pointHistorySchema.index({ userId: 1, createdAt: -1 });
userRewardSchema.index({ userId: 1, rewardId: 1 });

export const PointHistory = mongoose.model('PointHistory', pointHistorySchema);
export const Reward = mongoose.model('Reward', rewardSchema);
export const UserReward = mongoose.model('UserReward', userRewardSchema);
