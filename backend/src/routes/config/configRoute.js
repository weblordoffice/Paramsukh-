import express from 'express';
import {
  getWelcomeVideo,
  setWelcomeVideo,
  getRecommendationMappings,
  setRecommendationMappings,
  getShopGst,
  setShopGst
} from '../../controller/config/config.controller.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = express.Router();

// GET welcome video (public)
router.get('/welcome-video', getWelcomeVideo);

// POST update welcome video (admin only)
router.post('/welcome-video', adminAuth, requirePermission('manage_content'), setWelcomeVideo);

router.get('/shop-gst', adminAuth, requirePermission('manage_shop'), getShopGst);
router.post('/shop-gst', adminAuth, requirePermission('manage_shop'), setShopGst);

// GET recommendation mappings (public)
router.get('/recommendation-mappings', getRecommendationMappings);

// POST update recommendation mappings (admin only)
router.post('/recommendation-mappings', adminAuth, requirePermission('manage_content'), setRecommendationMappings);

export default router;
