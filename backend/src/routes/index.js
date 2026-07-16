import express from 'express';
import { sendOTPController, verifyOTPController } from '../controller/auth/authOTP.controller.js';
import { logout, getCurrentUser } from '../controller/auth/auth.controller.js';
import { refreshToken } from '../controller/auth/authController.js';
import { clerkSyncController } from '../controller/auth/clerkAuth.controller.js';
import { clerkWebhookHandler } from '../controller/auth/clerkWebhook.controller.js';
import { protectedRoutes } from '../middleware/protectedRoutes.js';
import { validateSendOTP, validateVerifyOTP } from '../middleware/validators.js';
import { otpLimiter } from '../middleware/rateLimiter.js';
import deviceRoute from './device/deviceRoute.js';

const router = express.Router();

// ========================================
// Authentication Routes
// ========================================
router.post('/send-otp', otpLimiter, validateSendOTP, sendOTPController);
router.post('/verify-otp', otpLimiter, validateVerifyOTP, verifyOTPController);
router.post('/clerk-sync', otpLimiter, clerkSyncController);
router.post('/refresh-token', refreshToken);
router.post('/logout', protectedRoutes, logout);
router.get('/me', protectedRoutes, getCurrentUser);
router.use('/devices', deviceRoute);

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
