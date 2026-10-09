import express from 'express';
import crypto from 'crypto';
import { getAllUpcomingLiveSessions } from '../../controller/courses/session.controller.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';

const router = express.Router();

// Allow either the admin panel (X-Admin-API-Key) or an app user (JWT).
// The admin notification composer uses this to list sessions for deep-links;
// the mobile home widget uses it with a user token.
const adminOrUserAuth = async (req, res, next) => {
  const apiKey = req.headers['x-admin-api-key'];
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (apiKey && adminApiKey) {
    const provided = Buffer.from(String(apiKey));
    const expected = Buffer.from(adminApiKey);
    if (provided.length === expected.length && crypto.timingSafeEqual(provided, expected)) {
      return next();
    }
  }

  return protectedRoutes(req, res, next);
};

// Upcoming live sessions across all published courses
router.get('/upcoming', adminOrUserAuth, getAllUpcomingLiveSessions);

export default router;
