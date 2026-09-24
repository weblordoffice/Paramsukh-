import { Donation } from '../../models/donation.models.js';
import { recordTransaction } from '../../services/transaction.service.js';
import { createRazorpayOrder, createRazorpayPaymentLink, fetchPaymentLink, verifyRazorpaySignature, fetchPaymentDetails, verifyRazorpayWebhookSignature, isRazorpayTestMode } from '../../services/razorpayService.js';
import { sendNotification } from '../notifications/notifications.controller.js';
import { sendDonationReceiptEmail } from '../../services/emailService.js';

// @desc    Record a new donation
// @route   POST /api/donations/record
// @access  Private
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
            status: 'completed'
        });

        res.status(201).json({ success: true, message: 'Donation recorded successfully', data: donation });

        recordTransaction({
          userId, userName: isAnonymous ? 'Anonymous' : userName,
          source: 'donation', sourceId: donation._id.toString(),
          amount, provider: paymentMethod || 'unknown', providerRef: transactionId,
          metadata: { paymentMethod, isAnonymous: !!isAnonymous },
        }).catch(err => console.error('Transaction recording failed:', err.message));
    } catch (error) {
        console.error('Record Donation Error:', error);
        res.status(500).json({ success: false, message: 'Failed to record donation' });
    }
};

// @desc    Create Razorpay order for donation
// @route   POST /api/donations/create-order
// @access  Private
export const createDonationOrder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { amount } = req.body;

        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Valid amount is required' });
        }

        const order = await createRazorpayOrder({
            amount: Number(amount),
            currency: 'INR',
            receipt: `don_${String(userId).slice(-6)}_${Date.now().toString(36)}`,
            notes: { type: 'donation', userId: userId.toString() }
        });

        return res.status(200).json({
            success: true,
            data: { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo' }
        });
    } catch (error) {
        console.error('Create Donation Order Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to create donation order' });
    }
};

// @desc    Create Razorpay payment link for donation
// @route   POST /api/donations/payment-link
// @access  Private
export const createDonationPaymentLink = async (req, res) => {
    try {
        const userId = req.user._id;
        const { amount, message, isAnonymous } = req.body;

        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Valid amount is required' });
        }

        const user = req.user;
        const link = await createRazorpayPaymentLink({
            amount: Number(amount),
            currency: 'INR',
            description: `Donation to Paramsukh Foundation`,
            customer: {
                name: isAnonymous ? 'Anonymous' : (user.displayName || user.name || 'Donor'),
                email: user.email || undefined,
                contact: user.phone ? String(user.phone).replace('+91', '').trim() : undefined,
            },
            notes: { type: 'donation', userId: userId.toString(), message: message || '', isAnonymous: String(isAnonymous || false) },
        });

        return res.status(200).json({
            success: true,
            data: { url: link.short_url, paymentLinkId: link.id, amount: Number(amount), expiresAt: link.expire_by ? new Date(link.expire_by * 1000) : null }
        });
    } catch (error) {
        console.error('Create Donation Payment Link Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to create payment link' });
    }
};

// @desc    Confirm donation payment link and mark donation completed
// @route   POST /api/donations/confirm-payment
// @access  Private
export const confirmDonationPayment = async (req, res) => {
    try {
        const userId = req.user._id;
        const { paymentLinkId } = req.body;
        if (!paymentLinkId) return res.status(400).json({ success: false, message: 'paymentLinkId required' });

        const link = await fetchPaymentLink(paymentLinkId);
        const status = String(link?.status || '').toLowerCase();
        const notes = link?.notes || {};

        if (notes?.userId && String(notes.userId) !== String(userId)) {
            return res.status(403).json({ success: false, message: 'Payment link does not belong to you' });
        }
        if (status !== 'paid' && status !== 'captured') {
            return res.status(200).json({ success: false, data: { status: link?.status }, message: 'Payment not completed yet' });
        }

        const amount = Number(link?.amount || 0) / 100;
        const paymentsRaw = link?.payments;
        const firstPayment = Array.isArray(paymentsRaw) ? paymentsRaw[0] : paymentsRaw;
        const paymentId = firstPayment?.payment_id || link?.payment_id;

        // Prevent duplicate donations
        const existing = await Donation.findOne({ transactionId: paymentId });
        if (existing) {
            return res.status(200).json({ success: true, message: 'Donation already recorded', data: existing });
        }

        const userName = req.user.displayName || req.user.name || 'Donor';
        const isAnonymous = String(notes?.isAnonymous || 'false').toLowerCase() === 'true';

        const donation = await Donation.create({
            userId,
            userName: isAnonymous ? 'Anonymous' : userName,
            phone: req.user.phone,
            amount,
            transactionId: paymentId,
            paymentMethod: 'razorpay',
            paymentLinkId,
            message: notes?.message || '',
            isAnonymous,
            status: 'completed'
        });

        recordTransaction({
            userId, userName: isAnonymous ? 'Anonymous' : userName,
            source: 'donation', sourceId: donation._id.toString(),
            amount, provider: 'razorpay', providerRef: paymentId,
            metadata: { paymentLinkId }
        }).catch(err => console.error('Transaction recording failed:', err.message));

        try {
            await sendNotification(userId, { type: 'system', title: 'Donation Received', message: `Thank you for your donation of ₹${amount}!`, icon: '🙏', priority: 'high', relatedId: donation._id, relatedType: 'donation' });
        } catch (e) { /* ignore */ }

        try {
            await sendDonationReceiptEmail(req.user, donation);
        } catch (e) {
            console.error('Donation receipt email failed:', e?.message || e);
        }

        return res.status(200).json({ success: true, message: 'Donation recorded — thank you!', data: donation });
    } catch (error) {
        console.error('Confirm Donation Payment Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to confirm donation' });
    }
};

// @desc    Verify Razorpay native-SDK payment and record donation
// @route   POST /api/donations/verify-payment
// @access  Private
export const verifyDonationPayment = async (req, res) => {
    try {
        const userId = req.user._id;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, message, isAnonymous } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Razorpay payment details required' });
        }

        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Valid amount is required' });
        }

        const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Fetch and validate payment details from Razorpay (strict checks only outside test mode)
        try {
            const paymentDetails = await fetchPaymentDetails(razorpay_payment_id);
            if (!isRazorpayTestMode) {
                if (paymentDetails.status !== 'captured') {
                    return res.status(400).json({ success: false, message: 'Payment not captured' });
                }
                if (paymentDetails.order_id !== razorpay_order_id) {
                    return res.status(400).json({ success: false, message: 'Payment order mismatch' });
                }
                if (Number(paymentDetails.amount) !== Math.round(Number(amount) * 100)) {
                    return res.status(400).json({ success: false, message: 'Payment amount mismatch' });
                }
            }
        } catch (e) {
            return res.status(400).json({ success: false, message: 'Could not verify payment with Razorpay' });
        }

        // Prevent duplicate donations (idempotent retry)
        const existing = await Donation.findOne({ transactionId: razorpay_payment_id });
        if (existing) {
            return res.status(200).json({ success: true, message: 'Donation already recorded', data: existing });
        }

        const userName = req.user.displayName || req.user.name || 'Donor';
        const anonymous = isAnonymous === true || String(isAnonymous || 'false').toLowerCase() === 'true';

        const donation = await Donation.create({
            userId,
            userName: anonymous ? 'Anonymous' : userName,
            phone: req.user.phone,
            amount: Number(amount),
            transactionId: razorpay_payment_id,
            paymentMethod: 'razorpay',
            message: message || '',
            isAnonymous: anonymous,
            status: 'completed'
        });

        recordTransaction({
            userId, userName: anonymous ? 'Anonymous' : userName,
            source: 'donation', sourceId: donation._id.toString(),
            amount: Number(amount), provider: 'razorpay', providerRef: razorpay_payment_id,
            metadata: { razorpayOrderId: razorpay_order_id, paymentMethod: 'razorpay', isAnonymous: anonymous },
        }).catch(err => console.error('Transaction recording failed:', err.message));

        try {
            await sendNotification(userId, { type: 'system', title: 'Donation Received', message: `Thank you for your donation of ₹${Number(amount)}!`, icon: '🙏', priority: 'high', relatedId: donation._id, relatedType: 'donation' });
        } catch (e) { /* ignore */ }

        try {
            await sendDonationReceiptEmail(req.user, donation);
        } catch (e) {
            console.error('Donation receipt email failed:', e?.message || e);
        }

        return res.status(200).json({ success: true, message: 'Donation recorded — thank you!', data: donation });
    } catch (error) {
        console.error('Verify Donation Payment Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to verify donation payment' });
    }
};

// @desc    Handle Razorpay webhook for donations
// @access  Public (Razorpay)
export const handleDonationWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const payload = req.body;

        if (!isRazorpayTestMode && !verifyRazorpayWebhookSignature(req.rawBody, signature)) {
            return res.status(400).json({ status: 'invalid_signature' });
        }

        if (payload.event === 'payment_link.paid' || payload.event === 'payment.captured') {
            const notes = payload?.payload?.payment_link?.entity?.notes || payload?.payload?.payment?.entity?.notes || {};
            if (notes?.type !== 'donation') return res.status(200).json({ status: 'ok' });

            const userId = notes.userId;
            const paymentId = payload?.payload?.payment?.entity?.id || payload?.payload?.payment_link?.entity?.id;

            const existing = await Donation.findOne({ transactionId: paymentId });
            if (existing) return res.status(200).json({ status: 'ok' });

            const amount = (payload?.payload?.payment?.entity?.amount || payload?.payload?.payment_link?.entity?.amount || 0) / 100;
            const isAnonymous = String(notes?.isAnonymous || 'false').toLowerCase() === 'true';

            const donation = await Donation.create({
                userId, userName: isAnonymous ? 'Anonymous' : 'Donor', amount, transactionId: paymentId,
                paymentMethod: 'razorpay', paymentLinkId: payload?.payload?.payment_link?.entity?.id || undefined,
                message: notes?.message || '', isAnonymous, status: 'completed'
            });

            try {
                const { User } = await import('../../models/user.models.js');
                const donor = await User.findById(userId).select('email displayName');
                if (donor) await sendDonationReceiptEmail(donor, donation);
            } catch (e) {
                console.error('Donation webhook email failed:', e?.message || e);
            }
        }

        return res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('Donation Webhook Error:', error);
        return res.status(500).json({ status: 'error' });
    }
};

// @desc    Get my donations
// @route   GET /api/donations/my-history
// @access  Private
export const getMyDonations = async (req, res) => {
    try {
        const donations = await Donation.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: donations });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch donations' });
    }
};

// @desc    Get all donations (Admin)
// @route   GET /api/donations/all
// @access  Admin
export const getAllDonations = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

        const query = {};
        if (status && ['initiated', 'completed', 'failed'].includes(status)) query.status = status;
        if (search) {
            const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [{ userName: { $regex: escaped, $options: 'i' } }, { message: { $regex: escaped, $options: 'i' } }, { phone: { $regex: escaped, $options: 'i' } }];
        }

        const [donations, total] = await Promise.all([
            Donation.find(query).sort({ createdAt: -1 }).limit(limitNum).skip((pageNum - 1) * limitNum),
            Donation.countDocuments(query)
        ]);

        const totalAmount = await Donation.aggregate([
            { $match: { ...query, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).then(r => r[0]?.total || 0);

        res.status(200).json({ success: true, data: { donations, totalAmount, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch all donations' });
    }
};
