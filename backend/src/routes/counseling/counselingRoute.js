import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { bookingLimiter } from '../../middleware/rateLimiter.js';
import { sanitizePostContent } from '../../middleware/sanitizeInput.js';
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
  getAllServicesAdmin,
  createService,
  updateService,
  deleteService
} from '../../controller/counseling/counseling.controller.js';
import {
  getAllBookings,
  getBookingDetailsAdmin,
  updateBookingStatusAdmin,
  updateBookingMeetingAdmin,
  deleteBookingAdmin,
  triggerCleanupExpired,
  triggerAutoComplete
} from '../../controller/counseling/admin.counseling.controller.js';
import {
  getAvailabilityExceptions,
  createAvailabilityException,
  updateAvailabilityException,
  deleteAvailabilityException
} from '../../controller/counseling/availabilityException.controller.js';

const router = express.Router();

// ========================================
// Public Routes
// ========================================
router.get('/services', getAllServices);
router.get('/availability', getAvailability);

// ========================================
// Admin Routes (Admin Auth)
// ========================================

// Service Management (MUST be before /admin/:id wildcard)
router.get('/admin/services', adminAuth, getAllServicesAdmin);
router.post('/admin/services', adminAuth, createService);
router.put('/admin/services/:id', adminAuth, updateService);
router.delete('/admin/services/:id', adminAuth, deleteService);

// Cleanup & Automation (MUST be before /admin/:id wildcard)
router.post('/admin/cleanup-expired', adminAuth, triggerCleanupExpired);
router.post('/admin/auto-complete', adminAuth, triggerAutoComplete);

// Availability Exceptions (MUST be before /admin/:id wildcard)
router.get('/admin/availability-exceptions', adminAuth, getAvailabilityExceptions);
router.post('/admin/availability-exceptions', adminAuth, createAvailabilityException);
router.put('/admin/availability-exceptions/:id', adminAuth, updateAvailabilityException);
router.delete('/admin/availability-exceptions/:id', adminAuth, deleteAvailabilityException);

// Booking Management (wildcard :id routes - must be LAST)
router.get('/all', adminAuth, getAllBookings);
router.get('/admin/:id', adminAuth, getBookingDetailsAdmin);
router.patch('/admin/:id/status', adminAuth, updateBookingStatusAdmin);
router.patch('/admin/:id/meeting', adminAuth, updateBookingMeetingAdmin);
router.delete('/admin/:id', adminAuth, deleteBookingAdmin);

// ========================================
// Protected Routes (User Auth)
// ========================================
router.use(protectedRoutes);

// Book a counseling session
router.post('/book', bookingLimiter, bookCounseling);

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
