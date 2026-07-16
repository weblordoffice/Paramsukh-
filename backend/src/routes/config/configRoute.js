import express from 'express';
import {
  getWelcomeVideo,
  setWelcomeVideo,
  getRecommendationMappings,
  setRecommendationMappings
} from '../../controller/config/config.controller.js';
import { adminAuth } from '../../middleware/adminAuth.js';

const router = express.Router();

// GET welcome video (public)
router.get('/welcome-video', getWelcomeVideo);

// POST update welcome video (admin only)
router.post('/welcome-video', adminAuth, setWelcomeVideo);

// GET recommendation mappings (public)
router.get('/recommendation-mappings', getRecommendationMappings);

// POST update recommendation mappings (admin only)
router.post('/recommendation-mappings', adminAuth, setRecommendationMappings);

export default router;
