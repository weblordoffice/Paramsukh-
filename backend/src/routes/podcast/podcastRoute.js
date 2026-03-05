import express from 'express';
import {
    createPodcast,
    getAllPodcasts,
    getPodcastDetails,
    updatePodcast,
    deletePodcast,
} from '../../controller/podcast/podcast.controller.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';

const router = express.Router();

// Public routes (or user protected if preferred, using protectedRoutes for now optionally or open)
// Assuming podcasts are public or for logged in users. 
// "connect to user facing api" likely refers to mobile app. 
// Standard pattern here seems to be separate files for admin routes? 
// No, courseRoute.js has admin routes too usually.

router.get('/', getAllPodcasts);
router.get('/:id', getPodcastDetails);

// Admin routes
router.post('/admin/create', adminAuth, createPodcast);
router.put('/admin/:id', adminAuth, updatePodcast);
router.delete('/admin/:id', adminAuth, deletePodcast);

export default router;
