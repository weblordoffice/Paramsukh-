import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { getMyCoupons } from '../../controller/coupons/user.coupons.controller.js';

const router = express.Router();

router.use(protectedRoutes);

router.get('/mine', getMyCoupons);

export default router;
