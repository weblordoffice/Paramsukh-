import express from 'express';
import {
  verifyByCertificateId,
  renderCertificateView,
} from '../../controller/user/certificate.controller.js';

const router = express.Router();

router.get('/verify/:certificateId', verifyByCertificateId);
router.get('/:certificateId/view', renderCertificateView);

export default router;
