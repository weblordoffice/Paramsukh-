import express from 'express';
import {
  submitMessage,
  getMyMessages,
  getMessageById,
  closeTicket
} from '../../controller/support/support.controller.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';

const router = express.Router();

router.post('/message', protectedRoutes, submitMessage);
router.get('/messages', protectedRoutes, getMyMessages);
router.get('/message/:id', protectedRoutes, getMessageById);
router.post('/message/:id/close', protectedRoutes, closeTicket);

export default router;