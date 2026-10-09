import express from 'express';
import { getAllUpcomingLiveSessions } from '../../controller/courses/session.controller.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';

const router = express.Router();

// Upcoming live sessions across all published courses
router.get('/upcoming', protectedRoutes, getAllUpcomingLiveSessions);

export default router;
