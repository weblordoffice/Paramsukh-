import express from 'express';
import { getAllUpcomingLiveSessions } from '../../controller/courses/session.controller.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { getAdminFromRequest, isValidAdminApiKey } from '../../middleware/adminAuth.js';

const router = express.Router();

// Allow either an admin (JWT or X-Admin-API-Key) or an app user (JWT).
// The admin notification composer uses this to list sessions for deep-links;
// the mobile home widget uses it with a user token.
const adminOrUserAuth = async (req, res, next) => {
  const admin = await getAdminFromRequest(req);
  if (admin) {
    req.admin = admin;
    return next();
  }

  if (isValidAdminApiKey(req)) {
    req.isAdminApiKey = true;
    return next();
  }

  return protectedRoutes(req, res, next);
};

// Upcoming live sessions across all published courses
router.get('/upcoming', adminOrUserAuth, getAllUpcomingLiveSessions);

export default router;
