import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import {
    recordDonation,
    getMyDonations,
    getAllDonations
} from '../../controller/donations/donations.controller.js';

const router = express.Router();

router.post('/record', protectedRoutes, recordDonation);
router.get('/my-history', protectedRoutes, getMyDonations);

// Admin Routes
router.get('/all', adminAuth, getAllDonations);

export default router;
