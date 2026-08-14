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
            const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { bookingTitle: { $regex: escaped, $options: 'i' } },
                { counselorName: { $regex: escaped, $options: 'i' } },
                { userPhone: { $regex: escaped, $options: 'i' } },
                { userEmail: { $regex: escaped, $options: 'i' } }
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

        // Prevent reactivating cancelled bookings to confirmed if slot was re-booked
        if (status === 'confirmed' && oldStatus === 'cancelled') {
            const existingConfirmed = await Booking.findOne({
                counselorType: booking.counselorType,
                bookingDate: booking.bookingDate,
                bookingTime: booking.bookingTime,
                status: { $in: ['pending', 'confirmed'] },
                _id: { $ne: booking._id }
            });
            if (existingConfirmed) {
                return res.status(409).json({
                    success: false,
                    message: 'Slot has been re-booked by another user. Cannot reactivate this booking.'
                });
            }
        }

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

            // Process refund for paid bookings
            if (!booking.isFree && booking.paymentStatus === 'paid' && booking.paymentId) {
                try {
                    const { createRefund } = await import('../../services/razorpayService.js');
                    const refund = await createRefund(booking.paymentId, Math.round(booking.amount * 100), {
                        booking_id: booking._id.toString(),
                        reason: reason || 'Admin cancellation',
                        cancelled_by: 'admin'
                    });
                    booking.refundId = refund.id;
                    booking.refundAmount = booking.amount;
                    booking.refundStatus = 'processed';
                    booking.refundProcessedAt = new Date();
                } catch (refundError) {
                    console.error('Admin refund failed:', refundError.message);
                    booking.refundStatus = 'failed';
                    booking.refundError = refundError.message;
                }
            }
        } else if (status === 'completed') {
            booking.completedAt = Date.now();
        }

        await booking.save();

        // Notify user if status changed
        if (oldStatus !== status) {
            await sendNotification(booking.user, {
                type: 'counseling_booked',
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

        if (meetingLink !== undefined) {
            const trimmed = String(meetingLink).trim();
            if (trimmed && !/^https?:\/\//i.test(trimmed)) {
                return res.status(400).json({
                    success: false,
                    message: 'Meeting link must be a valid http(s) URL'
                });
            }
            booking.meetingLink = trimmed || undefined;
        }
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
                type: 'counseling_reminder',
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

        const booking = await Booking.findById(id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Reject deletion of paid bookings — cancel them instead to process refund
        if (!booking.isFree && booking.paymentStatus === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete a paid booking. Cancel it to process a refund.'
            });
        }

        await Booking.findByIdAndDelete(id);

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
