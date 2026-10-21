import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { validateMongoIdParams } from '../../middleware/validators.js';
import {
  listLiveSessions,
  getLiveSession,
  registerForLiveSession,
  cancelLiveSessionRegistration,
  getMyLiveSessionRegistrations,
  downloadLiveSessionCalendar,
  listAdminLiveSessions,
  createLiveSession,
  updateLiveSession,
  deleteLiveSession,
  getLiveSessionConfig,
  listSessionRegistrationsAdmin,
} from '../../controller/liveSessions/liveSession.controller.js';

const router = express.Router();

// Admin routes
router.get('/admin/all', adminAuth, requirePermission('manage_courses'), listAdminLiveSessions);
router.get('/admin/config', adminAuth, requirePermission('manage_courses'), getLiveSessionConfig);
router.get('/admin/:id/registrations', adminAuth, requirePermission('manage_courses'), validateMongoIdParams('id'), listSessionRegistrationsAdmin);
router.post('/admin', adminAuth, requirePermission('manage_courses'), createLiveSession);
router.patch('/admin/:id', adminAuth, requirePermission('manage_courses'), validateMongoIdParams('id'), updateLiveSession);
router.delete('/admin/:id', adminAuth, requirePermission('manage_courses'), validateMongoIdParams('id'), deleteLiveSession);

// Public calendar download (session id is an unguessable ObjectId)
router.get('/:id/calendar.ics', validateMongoIdParams('id'), downloadLiveSessionCalendar);

// Authenticated user routes
router.use(protectedRoutes);
router.get('/my-registrations', getMyLiveSessionRegistrations);
router.get('/', listLiveSessions);
router.post('/:id/register', validateMongoIdParams('id'), registerForLiveSession);
router.delete('/:id/register', validateMongoIdParams('id'), cancelLiveSessionRegistration);
router.get('/:id', validateMongoIdParams('id'), getLiveSession);

export default router;
