import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import {
  fetchActiveMembership,
  fetchEligibleCourses,
  fetchSelectionStatus,
  handleSelectCourse,
  handleUndoSelection,
} from '../../controller/membership/courseSelection.controller.js';

const router = express.Router();

router.get('/active', protectedRoutes, fetchActiveMembership);
router.get('/:membershipId/eligible-courses', protectedRoutes, fetchEligibleCourses);
router.get('/:membershipId/selection-status', protectedRoutes, fetchSelectionStatus);
router.post('/:membershipId/select-course', protectedRoutes, handleSelectCourse);
router.post('/:membershipId/undo-selection', protectedRoutes, handleUndoSelection);

export default router;
