import express from 'express';
import { getWelcomeVideo, setWelcomeVideo } from '../../controller/config/config.controller.js';
import { adminAuth } from '../../middleware/adminAuth.js';

const router = express.Router();

// GET welcome video (public)
router.get('/welcome-video', getWelcomeVideo);

// POST update welcome video (admin only)
router.post('/welcome-video', adminAuth, setWelcomeVideo);

export default router;
