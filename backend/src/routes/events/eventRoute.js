import express from 'express';
import {
  createEvent,
  getAllEvents,
  getEventById,
  getEventBySlug,
  updateEvent,
  deleteEvent,
  getUpcomingEvents,
  getPastEvents,
  cancelEvent,
  addEventImages,
  addEventVideo
} from '../../controller/events/events.controller.js';
import {
  registerForEvent,
  cancelRegistration,
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

const router = express.Router();

// ========================================
// Event CRUD Routes
// ========================================

// Create new event
// POST /api/events/create
router.post('/create', adminAuth, createEvent);

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

// Get user's event registrations (must be before /:id)
// GET /api/events/my-registrations
router.get('/my-registrations', protectedRoutes, getMyRegistrations);

// Get event by ID
// GET /api/events/:id
router.get('/:id', getEventById);

// Update event
// PUT /api/events/:id
router.put('/:id', adminAuth, updateEvent);

// Delete event
// DELETE /api/events/:id
router.delete('/:id', adminAuth, deleteEvent);

// ========================================
// Event Actions
// ========================================

// Cancel event (soft delete - sets status to 'cancelled')
// PATCH /api/events/:id/cancel
router.patch('/:id/cancel', adminAuth, cancelEvent);

// Add images to event (for past events gallery)
// POST /api/events/:id/images
router.post('/:id/images', adminAuth, addEventImages);

// Add YouTube video to event (for recordings)
// POST /api/events/:id/videos
router.post('/:id/videos', adminAuth, addEventVideo);

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

// Check registration status
// GET /api/events/:eventId/registration-status
router.get('/:eventId/registration-status', protectedRoutes, getRegistrationStatus);

// Get all registrations for an event (admin)
// GET /api/events/:eventId/registrations
router.get('/:eventId/registrations', getEventRegistrations);

// Check-in user at event
// PATCH /api/events/:eventId/registrations/:registrationId/checkin
router.patch('/:eventId/registrations/:registrationId/checkin', adminAuth, checkInUser);

// Update payment status
// PATCH /api/events/:eventId/registrations/:registrationId/payment
router.patch('/:eventId/registrations/:registrationId/payment', adminAuth, updatePaymentStatus);

export default router;

