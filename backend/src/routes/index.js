import express from 'express';
import { sendOTPController, verifyOTPController } from '../controller/auth/authOTP.controller.js';
import { logout, getCurrentUser } from '../controller/auth/auth.controller.js';
import { refreshToken } from '../controller/auth/authController.js';
import { protectedRoutes } from '../middleware/protectedRoutes.js';
import { validateSendOTP, validateVerifyOTP } from '../middleware/validators.js';
import { otpLimiter } from '../middleware/rateLimiter.js';

import rewardsRoutes from './rewards/rewardsRoute.js';
import donationsRoutes from './donations/donationsRoute.js';

const router = express.Router();

// ========================================
// Authentication Routes
// ========================================
router.post('/send-otp', otpLimiter, validateSendOTP, sendOTPController);
router.post('/verify-otp', otpLimiter, validateVerifyOTP, verifyOTPController);
router.post('/refresh-token', refreshToken);
router.post('/logout', protectedRoutes, logout);
router.get('/me', protectedRoutes, getCurrentUser);

// ========================================
// New Feature Routes
// ========================================
router.use('/rewards', rewardsRoutes);
router.use('/donations', donationsRoutes);

// ========================================
// Health Check
// ========================================
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
