import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validateMongoIdParams } from '../../middleware/validators.js';
import {
  getAllOffersAdmin,
  createOffer,
  updateOffer,
  deleteOffer,
} from '../../controller/offers/offer.controller.js';

const router = express.Router();

router.get('/', adminAuth, requirePermission('manage_shop'), getAllOffersAdmin);
router.post('/', adminAuth, requirePermission('manage_shop'), createOffer);
router.patch('/:id', adminAuth, requirePermission('manage_shop'), validateMongoIdParams('id'), updateOffer);
router.delete('/:id', adminAuth, requirePermission('manage_shop'), validateMongoIdParams('id'), deleteOffer);

export default router;
