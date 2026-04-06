import Booking from '../../models/booking.models.js';
import { sendNotification } from '../notifications/notifications.controller.js';
import { cleanupExpiredBookings, autoCompletePastBookings } from '../../services/bookingCleanup.service.js';

// @desc    Get all bookings (Admin only)
// @route   GET /api/counseling/all
// @access  Admin
export const getAllBookings = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;

        const query = {};
        if (status) query.status = status;

        if (search) {
            query.$or = [
                { bookingTitle: { $regex: search, $options: 'i' } },
                { counselorName: { $regex: search, $options: 'i' } },
                { userPhone: { $regex: search, $options: 'i' } },
                { userEmail: { $regex: search, $options: 'i' } }
            ];
        }

        const bookings = await Booking.find(query)
            .populate('user', 'displayName email phone')
            .sort({ bookingDate: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const total = await Booking.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                bookings,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total
                }
            }
        });
    } catch (error) {
        console.error('Get All Bookings Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve bookings',
            error: error.message
        });
    }
};

// @desc    Get booking details (Admin)
// @route   GET /api/counseling/admin/:id
// @access  Admin
export const getBookingDetailsAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findById(id)
            .populate('user', 'displayName email phone');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { booking }
        });
    } catch (error) {
        console.error('Get Booking Details Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve booking details',
            error: error.message
        });
    }
};

// @desc    Update booking status (Admin only - Overrides rules)
// @route   PATCH /api/counseling/admin/:id/status
// @access  Admin
export const updateBookingStatusAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const oldStatus = booking.status;
        booking.status = status;

        // MEETING LINK VALIDATION: Require meeting link before marking as completed
        if (status === 'completed' && !booking.isFree) {
          if (!booking.meetingLink && !booking.meetingId) {
            return res.status(400).json({
              success: false,
              message: 'Cannot mark as completed. Please add a meeting link or meeting ID first.'
            });
          }
        }

        if (status === 'cancelled') {
            booking.cancelledAt = Date.now();
            booking.cancellationReason = reason || 'Cancelled by admin';
            booking.cancelledBy = 'admin';
        } else if (status === 'completed') {
            booking.completedAt = Date.now();
        }

        await booking.save();

        // Notify user if status changed
        if (oldStatus !== status) {
            await sendNotification(booking.user, {
                type: 'booking_status',
                title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                message: `Your counseling session on ${new Date(booking.bookingDate).toLocaleDateString()} is now ${status}`,
                icon: '📅',
                priority: 'medium',
                relatedId: booking._id,
                relatedType: 'booking'
            });
        }

        res.status(200).json({
            success: true,
            message: `Booking status updated to ${status}`,
            data: { booking }
        });
    } catch (error) {
        console.error('Update Booking Status Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update booking status',
            error: error.message
        });
    }
};

// @desc    Update meeting details for a booking (Admin – add Zoom/Meet link to take session)
// @route   PATCH /api/counseling/admin/:id/meeting
// @access  Admin
export const updateBookingMeetingAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { meetingLink, meetingId, meetingPassword, meetingPlatform } = req.body;

        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (meetingLink !== undefined) booking.meetingLink = meetingLink;
        if (meetingId !== undefined) booking.meetingId = meetingId;
        if (meetingPassword !== undefined) booking.meetingPassword = meetingPassword;
        if (meetingPlatform !== undefined) {
            const allowed = ['zoom', 'google_meet', 'phone', 'in_person'];
            if (allowed.includes(String(meetingPlatform).toLowerCase())) {
                booking.meetingPlatform = meetingPlatform.toLowerCase();
            }
        }

        await booking.save();

        // Notify user when meeting link is added so they can join
        if (meetingLink) {
            await sendNotification(booking.user, {
                type: 'booking_status',
                title: 'Session meeting link added',
                message: `Your counseling session on ${new Date(booking.bookingDate).toLocaleDateString()} at ${booking.bookingTime}: join link has been added. Check your booking details.`,
                icon: '🔗',
                priority: 'high',
                relatedId: booking._id,
                relatedType: 'booking'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Meeting details updated',
            data: { booking }
        });
    } catch (error) {
        console.error('Update Booking Meeting Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update meeting details',
            error: error.message
        });
    }
};

// @desc    Delete booking (Admin only)
// @route   DELETE /api/counseling/admin/:id
// @access  Admin
export const deleteBookingAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findByIdAndDelete(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Booking deleted successfully'
        });
    } catch (error) {
        console.error('Delete Booking Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete booking',
            error: error.message
        });
    }
};

// @desc    Cleanup expired unpaid bookings (Admin/Cron)
// @route   POST /api/counseling/admin/cleanup-expired
// @access  Admin
export const triggerCleanupExpired = async (req, res) => {
    try {
        const result = await cleanupExpiredBookings();
        res.status(200).json({
            success: true,
            message: 'Cleanup completed',
            data: result
        });
    } catch (error) {
        console.error('Cleanup Expired Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cleanup expired bookings',
            error: error.message
        });
    }
};

// @desc    Auto-complete past bookings (Admin/Cron)
// @route   POST /api/counseling/admin/auto-complete
// @access  Admin
export const triggerAutoComplete = async (req, res) => {
    try {
        const result = await autoCompletePastBookings();
        res.status(200).json({
            success: true,
            message: 'Auto-completion completed',
            data: result
        });
    } catch (error) {
        console.error('Auto Complete Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to auto-complete bookings',
            error: error.message
        });
    }
};
