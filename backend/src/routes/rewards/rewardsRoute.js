import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import {
    getRewardsCatalog,
    getUserRewardsStatus,
    redeemReward,
    createReward
} from '../../controller/rewards/rewards.controller.js';

const router = express.Router();

router.get('/catalog', getRewardsCatalog); // Public
router.get('/my-status', protectedRoutes, getUserRewardsStatus);
router.post('/redeem/:rewardId', protectedRoutes, redeemReward);

// Admin Routes
router.post('/create', adminAuth, createReward);

export default router;
