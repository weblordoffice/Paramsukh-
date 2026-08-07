import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import {
    recordDonation,
    getMyDonations,
    getAllDonations,
    createDonationOrder,
    createDonationPaymentLink,
    confirmDonationPayment,
    handleDonationWebhook
} from '../../controller/donations/donations.controller.js';

const router = express.Router();

// Razorpay donation flow
router.post('/create-order', protectedRoutes, createDonationOrder);
router.post('/payment-link', protectedRoutes, createDonationPaymentLink);
router.post('/confirm-payment', protectedRoutes, confirmDonationPayment);
router.post('/webhook', handleDonationWebhook);

// Legacy manual record
router.post('/record', protectedRoutes, recordDonation);

// User history
router.get('/my-history', protectedRoutes, getMyDonations);
router.get('/', protectedRoutes, getMyDonations);

// Admin routes
router.get('/all', adminAuth, getAllDonations);

export default router;
