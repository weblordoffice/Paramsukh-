import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import {
  getAvailability,
  bookCounseling,
  getMyBookings,
  getBookingDetails,
  cancelBooking,
  rescheduleBooking,
  updatePaymentStatus,
  submitFeedback,
  getAllServices,
  createService,
  updateService,
  deleteService
} from '../../controller/counseling/counseling.controller.js';
import {
  getAllBookings,
  getBookingDetailsAdmin,
  updateBookingStatusAdmin,
  updateBookingMeetingAdmin,
  deleteBookingAdmin
} from '../../controller/counseling/admin.counseling.controller.js';

const router = express.Router();

// ========================================
// Public Routes
// ========================================
router.get('/services', getAllServices);
router.get('/availability', getAvailability);

// ========================================
// Admin Routes (Admin Auth)
// ========================================

// Booking Management
router.get('/all', adminAuth, getAllBookings);
router.get('/admin/:id', adminAuth, getBookingDetailsAdmin);
router.patch('/admin/:id/status', adminAuth, updateBookingStatusAdmin);
router.patch('/admin/:id/meeting', adminAuth, updateBookingMeetingAdmin);
router.delete('/admin/:id', adminAuth, deleteBookingAdmin);

// Service Management
router.post('/admin/services', adminAuth, createService);
router.put('/admin/services/:id', adminAuth, updateService);
router.delete('/admin/services/:id', adminAuth, deleteService);

// ========================================
// Protected Routes (User Auth)
// ========================================
router.use(protectedRoutes);

// Book a counseling session
router.post('/book', bookCounseling);

// Get user's bookings
router.get('/my-bookings', getMyBookings);

// Get booking details
router.get('/:bookingId', getBookingDetails);

// Cancel a booking
router.patch('/:bookingId/cancel', cancelBooking);

// Reschedule a booking
router.patch('/:bookingId/reschedule', rescheduleBooking);

// Update payment status
router.post('/:bookingId/payment', updatePaymentStatus);

// Submit feedback for completed session
router.post('/:bookingId/feedback', submitFeedback);

export default router;
