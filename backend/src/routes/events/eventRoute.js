import express from 'express';
import {
  createEvent,
  getAllEvents,
  getEventById,
  getEventByIdAdmin,
  getEventBySlug,
  updateEvent,
  deleteEvent,
  getUpcomingEvents,
  getPastEvents,
  cancelEvent,
  addEventImages,
  addEventVideo,
  deleteEventImage,
  deleteEventVideo,
  downloadEventCalendar
} from '../../controller/events/events.controller.js';
import {
  registerForEvent,
  cancelRegistration,
  cancelRegistrationAdmin,
  refundRegistrationAdmin,
  getMeetingLink,
  getMyRegistrations,
  getRegistrationStatus,
  getEventRegistrations,
  checkInUser,
  updatePaymentStatus,
  createEventRegistrationOrder,
  confirmEventPayment,
  createEventRegistrationLink,
  confirmEventPaymentByLink
} from '../../controller/events/eventRegistration.controller.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { requireResourceScope, requireAllPermissionScope } from '../../middleware/permissionScope.js';
import { validateCreateEvent, validateUpdateEvent } from '../../middleware/validators.js';

const router = express.Router();
const requireEventScope = requireResourceScope(
  'manage_events',
  'id',
  (req) => req.params.eventId || req.params.id
);

// ========================================
// Event CRUD Routes
// ========================================

// Create new event
// POST /api/events/create
router.post('/create', adminAuth, requirePermission('manage_events'), requireAllPermissionScope('manage_events'), validateCreateEvent, createEvent);

// Get all events with filters
// GET /api/events/all
// Query params: status, category, isPaid, locationType, search, page, limit, sortBy, sortOrder
router.get('/all', getAllEvents);

// Get upcoming events (convenience endpoint)
// GET /api/events/upcoming
router.get('/upcoming', getUpcomingEvents);

// Get past events (convenience endpoint)
// GET /api/events/past
router.get('/past', getPastEvents);

// Get event by slug (must be before /:id to avoid conflicts)
// GET /api/events/slug/:slug
router.get('/slug/:slug', getEventBySlug);

// Get a full event for the admin editor (must be before /:id)
// GET /api/events/admin/:id
router.get('/admin/:id', adminAuth, requirePermission('manage_events'), requireEventScope, getEventByIdAdmin);

// Get user's event registrations (must be before /:id)
// GET /api/events/my-registrations
router.get('/my-registrations', protectedRoutes, getMyRegistrations);

// Public calendar download (event id is an unguessable ObjectId)
// GET /api/events/:id/calendar.ics
router.get('/:id/calendar.ics', downloadEventCalendar);

// Get event by ID
router.get('/:id', getEventById);

// Update event
// PUT /api/events/:id
router.put('/:id', adminAuth, requirePermission('manage_events'), requireEventScope, validateUpdateEvent, updateEvent);

// Delete event
// DELETE /api/events/:id
router.delete('/:id', adminAuth, requirePermission('manage_events'), requireEventScope, deleteEvent);

// ========================================
// Event Actions
// ========================================

// Cancel event (soft delete - sets status to 'cancelled')
// PATCH /api/events/:id/cancel
router.patch('/:id/cancel', adminAuth, requirePermission('manage_events'), requireEventScope, cancelEvent);

// Add images to event (for past events gallery)
// POST /api/events/:id/images
router.post('/:id/images', adminAuth, requirePermission('manage_events'), requireEventScope, addEventImages);

// Add YouTube video to event (for recordings)
// POST /api/events/:id/videos
router.post('/:id/videos', adminAuth, requirePermission('manage_events'), requireEventScope, addEventVideo);

// Delete single image from event (by url or _id)
// DELETE /api/events/:id/images
router.delete('/:id/images', adminAuth, requirePermission('manage_events'), requireEventScope, deleteEventImage);

// Delete single video from event (by url or _id)
// DELETE /api/events/:id/videos
router.delete('/:id/videos', adminAuth, requirePermission('manage_events'), requireEventScope, deleteEventVideo);

// ========================================
// Event Registration Routes (Protected)
// ========================================

// Create Razorpay order for paid event (books spot, then user pays)
// POST /api/events/:eventId/register/order
router.post('/:eventId/register/order', protectedRoutes, createEventRegistrationOrder);
// Create payment link for event (hosted checkout – works without native SDK)
// POST /api/events/:eventId/register/link
router.post('/:eventId/register/link', protectedRoutes, createEventRegistrationLink);
// Confirm event payment after Razorpay success (adds to My Purchases)
// POST /api/events/:eventId/register/confirm
router.post('/:eventId/register/confirm', protectedRoutes, confirmEventPayment);
// Confirm event payment link
// POST /api/events/:eventId/register/confirm-link
router.post('/:eventId/register/confirm-link', protectedRoutes, confirmEventPaymentByLink);
// Register for an event (free events only; paid events use order + confirm)
// POST /api/events/:eventId/register
router.post('/:eventId/register', protectedRoutes, registerForEvent);

// Cancel registration
// DELETE /api/events/:eventId/register
router.delete('/:eventId/register', protectedRoutes, cancelRegistration);

// Get registration status
// GET /api/events/:eventId/registration-status
router.get('/:eventId/registration-status', protectedRoutes, getRegistrationStatus);

// Get the online meeting link (confirmed + paid registrations only)
// GET /api/events/:eventId/meeting-link
router.get('/:eventId/meeting-link', protectedRoutes, getMeetingLink);

// Get all registrations for an event (admin only)
// GET /api/events/:eventId/registrations
router.get('/:eventId/registrations', adminAuth, requirePermission('manage_events'), requireEventScope, getEventRegistrations);

// Check-in user at event (or mark no-show with { status: 'no-show' })
// PATCH /api/events/:eventId/registrations/:registrationId/checkin
router.patch('/:eventId/registrations/:registrationId/checkin', adminAuth, requirePermission('manage_events'), requireEventScope, checkInUser);

// Refund a paid registration (admin)
// POST /api/events/:eventId/registrations/:registrationId/refund
router.post('/:eventId/registrations/:registrationId/refund', adminAuth, requirePermission('manage_events'), requireEventScope, refundRegistrationAdmin);

// Cancel a registration (admin)
// DELETE /api/events/:eventId/registrations/:registrationId
router.delete('/:eventId/registrations/:registrationId', adminAuth, requirePermission('manage_events'), requireEventScope, cancelRegistrationAdmin);

// Update payment status
// PATCH /api/events/:eventId/registrations/:registrationId/payment
router.patch('/:eventId/registrations/:registrationId/payment', adminAuth, requirePermission('manage_events'), requireEventScope, updatePaymentStatus);

export default router;

