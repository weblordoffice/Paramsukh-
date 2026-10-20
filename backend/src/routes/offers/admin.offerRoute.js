import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { validateMongoIdParams } from '../../middleware/validators.js';
import {
  getAllOffersAdmin,
  createOffer,
  updateOffer,
  deleteOffer,
} from '../../controller/offers/offer.controller.js';

const router = express.Router();

router.get('/', adminAuth, getAllOffersAdmin);
router.post('/', adminAuth, createOffer);
router.patch('/:id', adminAuth, validateMongoIdParams('id'), updateOffer);
router.delete('/:id', adminAuth, validateMongoIdParams('id'), deleteOffer);

export default router;
