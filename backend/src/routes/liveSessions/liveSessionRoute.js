import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { validateMongoIdParams } from '../../middleware/validators.js';
import {
  listLiveSessions,
  getLiveSession,
  listAdminLiveSessions,
  createLiveSession,
  updateLiveSession,
  deleteLiveSession,
} from '../../controller/liveSessions/liveSession.controller.js';

const router = express.Router();

// Admin routes
router.get('/admin/all', adminAuth, listAdminLiveSessions);
router.post('/admin', adminAuth, createLiveSession);
router.patch('/admin/:id', adminAuth, validateMongoIdParams('id'), updateLiveSession);
router.delete('/admin/:id', adminAuth, validateMongoIdParams('id'), deleteLiveSession);

// Authenticated user routes
router.use(protectedRoutes);
router.get('/', listLiveSessions);
router.get('/:id', validateMongoIdParams('id'), getLiveSession);

export default router;
