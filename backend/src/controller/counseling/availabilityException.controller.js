import mongoose from 'mongoose';
import CounselorAvailabilityException from '../../models/counselorAvailabilityException.model.js';
import CounselingService from '../../models/counselingService.model.js';
import Booking from '../../models/booking.models.js';
import { startOfUtcDay, toDateKey } from '../../utils/timezone.js';

// @desc    Get all availability exceptions (Admin)
// @route   GET /api/counseling/admin/availability-exceptions
// @access  Admin
export const getAvailabilityExceptions = async (req, res) => {
  try {
    const { serviceId, upcoming = false } = req.query;
    
    const query = {};
    if (serviceId) query.serviceId = serviceId;
    if (upcoming === 'true') query.unavailableDate = { $gte: startOfUtcDay(new Date()) };

    const exceptions = await CounselorAvailabilityException.find(query)
      .populate('serviceId', 'title')
      .populate('createdBy', 'displayName')
      .sort({ unavailableDate: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: { exceptions, total: exceptions.length }
    });
  } catch (error) {
    console.error('Get Exceptions Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch availability exceptions',
      error: error.message
    });
  }
};

// @desc    Create availability exception (Admin)
// @route   POST /api/counseling/admin/availability-exceptions
// @access  Admin
export const createAvailabilityException = async (req, res) => {
  try {
    const { serviceId, unavailableDate, reason, notes, force } = req.body;

    if (!serviceId || !unavailableDate) {
      return res.status(400).json({
        success: false,
        message: 'Service ID and unavailable date are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(String(serviceId))) {
      return res.status(400).json({ success: false, message: 'Invalid service id' });
    }

    const dateKey = toDateKey(unavailableDate);
    const normalizedDate = dateKey ? startOfUtcDay(dateKey) : null;
    if (!normalizedDate) {
      return res.status(400).json({ success: false, message: 'Invalid unavailable date' });
    }
    if (normalizedDate < startOfUtcDay(new Date())) {
      return res.status(400).json({ success: false, message: 'Cannot block a past date' });
    }

    // Verify service exists
    const service = await CounselingService.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Counseling service not found'
      });
    }

    const dayEnd = new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000);
    const existingBookings = await Booking.countDocuments({
      $or: [{ serviceId: service._id }, { counselorType: service.title }],
      bookingDate: { $gte: normalizedDate, $lt: dayEnd },
      status: { $in: ['pending', 'confirmed'] },
    });
    if (existingBookings > 0 && force !== true) {
      return res.status(409).json({
        success: false,
        message: `${existingBookings} active booking(s) already exist on this date. Cancel them first or resend with force=true.`
      });
    }

    const exception = new CounselorAvailabilityException({
      serviceId,
      unavailableDate: normalizedDate,
      reason: reason || 'other',
      notes,
      createdBy: req.admin?._id || req.user?._id || null
    });

    await exception.save();

    res.status(201).json({
      success: true,
      message: 'Availability exception created',
      data: { exception }
    });
  } catch (error) {
    console.error('Create Exception Error:', error);
    
    // Handle duplicate exception
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'An exception already exists for this service on this date'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create availability exception',
      error: error.message
    });
  }
};

// @desc    Update availability exception (Admin)
// @route   PUT /api/counseling/admin/availability-exceptions/:id
// @access  Admin
export const updateAvailabilityException = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notes, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid exception id' });
    }

    const exception = await CounselorAvailabilityException.findByIdAndUpdate(
      id,
      { reason, notes, isActive },
      { new: true, runValidators: true }
    );

    if (!exception) {
      return res.status(404).json({
        success: false,
        message: 'Exception not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Exception updated',
      data: { exception }
    });
  } catch (error) {
    console.error('Update Exception Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update exception',
      error: error.message
    });
  }
};

// @desc    Delete availability exception (Admin)
// @route   DELETE /api/counseling/admin/availability-exceptions/:id
// @access  Admin
export const deleteAvailabilityException = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid exception id' });
    }

    const exception = await CounselorAvailabilityException.findByIdAndDelete(id);

    if (!exception) {
      return res.status(404).json({
        success: false,
        message: 'Exception not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Exception deleted'
    });
  } catch (error) {
    console.error('Delete Exception Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete exception',
      error: error.message
    });
  }
};
