import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { validateMongoIdParams } from '../../middleware/validators.js';
import {
  listWellnessGoals,
  createWellnessGoal,
  updateWellnessGoal,
  updateWellnessGoalProgress,
  deleteWellnessGoal,
} from '../../controller/wellness/wellnessGoal.controller.js';

const router = express.Router();

router.use(protectedRoutes);

router.get('/', listWellnessGoals);
router.post('/', createWellnessGoal);
router.patch('/:id/progress', validateMongoIdParams('id'), updateWellnessGoalProgress);
router.patch('/:id', validateMongoIdParams('id'), updateWellnessGoal);
router.delete('/:id', validateMongoIdParams('id'), deleteWellnessGoal);

export default router;
