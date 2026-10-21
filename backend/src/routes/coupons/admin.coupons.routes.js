import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon
} from '../../controller/coupons/admin.coupons.controller.js';

const router = express.Router();

router.post('/', adminAuth, requirePermission('manage_shop'), createCoupon);
router.get('/', adminAuth, requirePermission('manage_shop'), getAllCoupons);
router.get('/:id', adminAuth, requirePermission('manage_shop'), getCouponById);
router.put('/:id', adminAuth, requirePermission('manage_shop'), updateCoupon);
router.delete('/:id', adminAuth, requirePermission('manage_shop'), deleteCoupon);

export default router;
