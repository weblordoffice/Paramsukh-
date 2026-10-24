import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { bookingLimiter } from '../../middleware/rateLimiter.js';
import { validateMongoIdParams } from '../../middleware/validators.js';
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
  deleteService,
  requestReschedule,
  respondToReschedule
} from '../../controller/counseling/counseling.controller.js';
import {
  getAllBookings,
  getBookingDetailsAdmin,
  updateBookingStatusAdmin,
  updateBookingMeetingAdmin,
  deleteBookingAdmin,
  triggerCleanupExpired,
  triggerAutoComplete,
  requestRescheduleAdmin,
  respondRescheduleAdmin,
  refundBookingAdmin,
  wipeCounselingData,
  getPendingRescheduleRequests
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
router.get('/availability', protectedRoutes, getAvailability);

// ========================================
// Admin Routes (Admin Auth)
// ========================================

// Service Management (MUST be before /admin/:id wildcard)
router.get('/admin/services', adminAuth, requirePermission('manage_content'), getAllServicesAdmin);
router.post('/admin/services', adminAuth, requirePermission('manage_content'), createService);
router.put('/admin/services/:id', adminAuth, requirePermission('manage_content'), validateMongoIdParams('id'), updateService);
router.delete('/admin/services/:id', adminAuth, requirePermission('manage_content'), validateMongoIdParams('id'), deleteService);

// Cleanup & Automation (MUST be before /admin/:id wildcard)
router.post('/admin/cleanup-expired', adminAuth, requirePermission('manage_content'), triggerCleanupExpired);
router.post('/admin/auto-complete', adminAuth, requirePermission('manage_content'), triggerAutoComplete);
router.delete('/admin/wipe', adminAuth, requirePermission('manage_content'), wipeCounselingData);
router.get('/admin/reschedule-requests', adminAuth, requirePermission('manage_content'), getPendingRescheduleRequests);

// Availability Exceptions (MUST be before /admin/:id wildcard)
router.get('/admin/availability-exceptions', adminAuth, requirePermission('manage_content'), getAvailabilityExceptions);
router.post('/admin/availability-exceptions', adminAuth, requirePermission('manage_content'), createAvailabilityException);
router.put('/admin/availability-exceptions/:id', adminAuth, requirePermission('manage_content'), validateMongoIdParams('id'), updateAvailabilityException);
router.delete('/admin/availability-exceptions/:id', adminAuth, requirePermission('manage_content'), validateMongoIdParams('id'), deleteAvailabilityException);

// Booking Management (wildcard :id routes - must be LAST)
router.get('/all', adminAuth, requirePermission('manage_content'), getAllBookings);
router.get('/admin/:id', adminAuth, requirePermission('manage_content'), validateMongoIdParams('id'), getBookingDetailsAdmin);
router.patch('/admin/:id/status', adminAuth, requirePermission('manage_content'), validateMongoIdParams('id'), updateBookingStatusAdmin);
router.patch('/admin/:id/meeting', adminAuth, requirePermission('manage_content'), validateMongoIdParams('id'), updateBookingMeetingAdmin);
router.post('/admin/:id/refund', adminAuth, requirePermission('manage_content'), validateMongoIdParams('id'), refundBookingAdmin);
router.post('/admin/:id/reschedule-request', adminAuth, requirePermission('manage_content'), validateMongoIdParams('id'), requestRescheduleAdmin);
router.post('/admin/:id/reschedule-respond', adminAuth, requirePermission('manage_content'), validateMongoIdParams('id'), respondRescheduleAdmin);
router.delete('/admin/:id', adminAuth, requirePermission('manage_content'), validateMongoIdParams('id'), deleteBookingAdmin);

// ========================================
// Protected Routes (User Auth)
// ========================================
router.use(protectedRoutes);

// Book a counseling session
router.post('/book', bookingLimiter, bookCounseling);

// Get user's bookings
router.get('/my-bookings', getMyBookings);

// Get booking details
router.get('/:bookingId', validateMongoIdParams('bookingId'), getBookingDetails);

// Cancel a booking
router.patch('/:bookingId/cancel', validateMongoIdParams('bookingId'), cancelBooking);

// Reschedule a booking
router.patch('/:bookingId/reschedule', validateMongoIdParams('bookingId'), rescheduleBooking);

// User requests reschedule → admin approval
router.post('/:bookingId/reschedule-request', validateMongoIdParams('bookingId'), requestReschedule);

// User responds to admin-initiated reschedule request
router.post('/:bookingId/reschedule-respond', validateMongoIdParams('bookingId'), respondToReschedule);

// Update payment status
router.post('/:bookingId/payment', validateMongoIdParams('bookingId'), updatePaymentStatus);

// Submit feedback for completed session
router.post('/:bookingId/feedback', validateMongoIdParams('bookingId'), submitFeedback);

export default router;
