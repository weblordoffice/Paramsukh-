import { Donation } from '../../models/donation.models.js';

// @desc    Record a new donation
// @route   POST /api/donations/record
// @access  Private (or Public if anonymous supported later)
export const recordDonation = async (req, res) => {
    try {
        const { amount, transactionId, paymentMethod, message, isAnonymous } = req.body;
        const userId = req.user._id;
        const userName = req.user.displayName;
        const phone = req.user.phone;

        const donation = await Donation.create({
            userId,
            userName: isAnonymous ? 'Anonymous' : userName,
            phone,
            amount,
            transactionId,
            paymentMethod,
            message,
            isAnonymous: isAnonymous || false,
            status: 'completed' // Assuming client only calls this after success
        });

        res.status(201).json({
            success: true,
            message: 'Donation recorded successfully',
            data: donation
        });
    } catch (error) {
        console.error('Record Donation Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record donation'
        });
    }
};

// @desc    Get my donations
// @route   GET /api/donations/my-history
// @access  Private
export const getMyDonations = async (req, res) => {
    try {
        const donations = await Donation.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: donations
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch donations' });
    }
};

// @desc    Get all donations (Admin)
// @route   GET /api/donations/all
// @access  Admin
export const getAllDonations = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const donations = await Donation.find()
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Donation.countDocuments();

        res.status(200).json({
            success: true,
            data: {
                donations,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch all donations' });
    }
};
