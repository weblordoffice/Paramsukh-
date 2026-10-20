import express from 'express';
import { listActiveOffers } from '../../controller/offers/offer.controller.js';

const router = express.Router();

router.get('/', listActiveOffers);

export default router;
