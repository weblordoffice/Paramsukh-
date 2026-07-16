import express from 'express';
import {
    createPodcast,
    getAllPodcasts,
    getPodcastDetails,
    updatePodcast,
    deletePodcast,
    getUserAccessiblePodcasts,
    getPodcastForStream,
    getUserPodcastPurchases,
    checkPodcastPurchaseStatus,
    getAdminAllPodcasts,
    toggleFavorite,
    getUserFavorites,
    checkFavoriteStatus,
} from '../../controller/podcast/podcast.controller.js';
import {
    createPodcastPaymentLink,
    confirmPodcastPayment,
    handlePodcastPaymentWebhook,
} from '../../controller/podcast/podcastPayment.controller.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';

const router = express.Router();

// Public routes (free podcasts only)
router.get('/', getAllPodcasts);
router.get('/:id/details', getPodcastDetails);

// Protected routes (authenticated users get free + membership + purchased)
router.get('/user/accessible', protectedRoutes, getUserAccessiblePodcasts);
router.get('/:id/stream', protectedRoutes, getPodcastForStream);
router.get('/user/purchases', protectedRoutes, getUserPodcastPurchases);
router.get('/:podcastId/purchase-status', protectedRoutes, checkPodcastPurchaseStatus);

// Payment routes (protected)
router.post('/:id/create-payment', protectedRoutes, createPodcastPaymentLink);
router.post('/:id/confirm-payment', protectedRoutes, confirmPodcastPayment);
router.post('/webhook/razorpay', handlePodcastPaymentWebhook);

// Favorites routes (protected)
router.get('/favorites', protectedRoutes, getUserFavorites);
router.post('/:id/favorite', protectedRoutes, toggleFavorite);
router.get('/:id/favorite-status', protectedRoutes, checkFavoriteStatus);

// Admin routes
router.get('/admin/all', adminAuth, getAdminAllPodcasts);
router.post('/admin/create', adminAuth, createPodcast);
router.put('/admin/:id', adminAuth, updatePodcast);
router.delete('/admin/:id', adminAuth, deletePodcast);

export default router;
