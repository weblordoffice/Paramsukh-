import express from 'express';
import {
  verifyByCertificateId,
  renderCertificateView,
  downloadCertificate,
} from '../../controller/user/certificate.controller.js';

const router = express.Router();

router.get('/verify/:certificateId', verifyByCertificateId);
router.get('/:certificateId/download', downloadCertificate);
router.get('/:certificateId/view', renderCertificateView);

export default router;
