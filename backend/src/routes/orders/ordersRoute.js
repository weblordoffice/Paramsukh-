import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import {
  createOrder,
  getAllOrders,
  getMyOrders,
  getOrderDetails,
  cancelOrder,
  requestReturn,
  trackOrder,
  getInvoice,
  verifyOrderPayment,
  createOrderPaymentLink,
  verifyOrderPaymentByLink
} from '../../controller/orders/orders.controller.js';
import {
  updateOrderStatusAdmin,
  getOrderDetailsAdmin
} from '../../controller/orders/admin.orders.controller.js';

const router = express.Router();

// Admin routes
router.get('/all', adminAuth, getAllOrders);
router.get('/:id/admin', adminAuth, getOrderDetailsAdmin);
router.patch('/:id/status', adminAuth, updateOrderStatusAdmin);

// All other routes are protected
router.use(protectedRoutes);

router.post('/create', createOrder);
router.get('/my-orders', getMyOrders);
router.post('/verify-payment', verifyOrderPayment);
router.post('/confirm-payment-link', verifyOrderPaymentByLink);
router.post('/:orderId/payment-link', createOrderPaymentLink);
router.get('/:id', getOrderDetails);
router.patch('/:id/cancel', cancelOrder);
router.post('/:id/return', requestReturn);
router.get('/:id/track', trackOrder);
router.get('/:id/invoice', getInvoice);

export default router;
