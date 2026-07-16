import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import {
  heartbeat,
  getActiveDevices,
  revokeDevice,
  logoutOthers
} from '../../controller/device/device.controller.js';

const router = express.Router();

// Apply protectedRoutes middleware to all device endpoints
router.use(protectedRoutes);

/**
 * GET /api/auth/devices
 * Retrieves a list of active device sessions
 */
router.get('/', getActiveDevices);

/**
 * POST /api/auth/devices/heartbeat
 * Logs user heartbeat to keep current device session active
 */
router.post('/heartbeat', heartbeat);

/**
 * POST /api/auth/devices/logout-others
 * Terminates all other active device sessions
 */
router.post('/logout-others', logoutOthers);

/**
 * DELETE /api/auth/devices/:deviceId
 * Revokes access for a specific device session
 */
router.delete('/:deviceId', revokeDevice);

export default router;
