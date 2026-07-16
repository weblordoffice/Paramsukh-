import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon
} from '../../controller/coupons/admin.coupons.controller.js';

const router = express.Router();

router.post('/', adminAuth, createCoupon);
router.get('/', adminAuth, getAllCoupons);
router.get('/:id', adminAuth, getCouponById);
router.put('/:id', adminAuth, updateCoupon);
router.delete('/:id', adminAuth, deleteCoupon);

export default router;
