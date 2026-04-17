import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { paymentLimiter } from '../../middleware/rateLimiter.js';
import { validateCreateOrder, validateVerifyPayment } from '../../middleware/validators.js';
import {
  createMembershipOrder,
  createMembershipPaymentLink,
  createAdminMembershipPaymentLink,
  getAdminMembershipPaymentLinks,
  confirmMembershipPaymentLink,
  syncMembershipFromRazorpay,
  createBookingOrder,
  createBookingPaymentLink,
  confirmBookingPaymentLink,
  verifyMembershipPayment,
  handleWebhook,
  getPaymentHistory
} from '../../controller/payments/payments.controller.js';

const router = express.Router();

// ========================================
// Payment Order Creation Routes
// ========================================

// Create payment order for membership
// POST /api/payments/create-order
router.post('/create-order', protectedRoutes, createMembershipOrder);

// Create hosted payment link for membership (opens Razorpay checkout page)
// POST /api/payments/membership-link
router.post('/membership-link', protectedRoutes, paymentLimiter, createMembershipPaymentLink);

// Create hosted membership payment link for any user (admin flow)
// POST /api/payments/admin/membership-link
router.post('/admin/membership-link', adminAuth, paymentLimiter, createAdminMembershipPaymentLink);

// List admin-generated membership payment links
// GET /api/payments/admin/membership-links
router.get('/admin/membership-links', adminAuth, getAdminMembershipPaymentLinks);

// Confirm payment link status and activate (fallback for local dev when webhook can't reach)
// POST /api/payments/membership-link/confirm
router.post('/membership-link/confirm', protectedRoutes, paymentLimiter, confirmMembershipPaymentLink);

// Sync membership from Razorpay (find paid link for this user and activate – e.g. "I already paid")
// POST /api/payments/sync-membership
router.post('/sync-membership', protectedRoutes, paymentLimiter, syncMembershipFromRazorpay);

// Create payment order for booking/counseling
// POST /api/payments/create-booking-order
router.post('/create-booking-order', protectedRoutes, createBookingOrder);

// Create payment link for counseling booking (hosted checkout)
// POST /api/payments/booking-link
router.post('/booking-link', protectedRoutes, paymentLimiter, createBookingPaymentLink);
// Confirm booking payment link
// POST /api/payments/booking-link/confirm
router.post('/booking-link/confirm', protectedRoutes, paymentLimiter, confirmBookingPaymentLink);

// ========================================
// Payment Verification Routes
// ========================================

// Verify membership payment and activate
// POST /api/payments/verify-membership
router.post('/verify-membership', protectedRoutes, verifyMembershipPayment);

// ========================================
// Payment History
// ========================================

// Get user's payment history
// GET /api/payments/history
router.get('/history', protectedRoutes, getPaymentHistory);

// ========================================
// Webhook (No Auth)
// ========================================

// Razorpay webhook endpoint
// POST /api/payments/webhook
router.post('/webhook', handleWebhook);

export default router;
