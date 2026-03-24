import {
    createRazorpayPaymentLink,
    fetchPaymentLink,
    verifyRazorpayWebhookSignature,
} from '../../services/razorpayService.js';
import Podcast from '../../models/podcast.model.js';
import PodcastPurchase from '../../models/podcastPurchase.model.js';
import { User } from '../../models/user.models.js';
import { sendNotification } from '../notifications/notifications.controller.js';

/**
 * Create payment link for podcast purchase
 * POST /api/podcasts/:id/create-payment
 */
export const createPodcastPaymentLink = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const podcastId = req.params.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        // Check if podcast exists
        const podcast = await Podcast.findById(podcastId);
        if (!podcast) {
            return res.status(404).json({
                success: false,
                message: 'Podcast not found',
            });
        }

        // Check if podcast is paid
        if (podcast.accessType !== 'paid') {
            return res.status(400).json({
                success: false,
                message: 'This podcast is not available for purchase',
            });
        }

        // Check if user has already purchased
        const existingPurchase = await PodcastPurchase.findOne({
            userId,
            podcastId,
        });

        if (existingPurchase) {
            return res.status(400).json({
                success: false,
                message: 'You have already purchased this podcast',
            });
        }

        const amount = Number(podcast.price) || 0;
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid podcast price',
            });
        }

        const user = await User.findById(userId).select('email phone displayName name');

        const customer = {
            name: user?.displayName || user?.name || 'Customer',
            email: user?.email || undefined,
            contact: user?.phone ? String(user.phone).replace('+91', '').trim() : undefined,
        };

        // Create Razorpay payment link
        const link = await createRazorpayPaymentLink({
            amount,
            currency: podcast.currencyCode || 'INR',
            description: `Podcast: ${podcast.title}`,
            customer,
            notes: {
                type: 'podcast',
                podcastId: String(podcastId),
                userId: String(userId),
                podcastTitle: podcast.title,
            },
        });

        res.status(200).json({
            success: true,
            message: 'Payment link created successfully',
            data: {
                url: link.short_url,
                paymentLinkId: link.id,
                amount: podcast.price,
                currency: podcast.currencyCode || 'INR',
            },
        });
    } catch (error) {
        console.error('Create Podcast Payment Link Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment link',
            error: error.message,
        });
    }
};

/**
 * Confirm podcast payment and mark purchase
 * POST /api/podcasts/:id/confirm-payment
 */
export const confirmPodcastPayment = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const podcastId = req.params.id;
        const { paymentLinkId } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        if (!paymentLinkId) {
            return res.status(400).json({
                success: false,
                message: 'paymentLinkId is required',
            });
        }

        // Fetch payment link status
        const link = await fetchPaymentLink(paymentLinkId);
        const status = String(link?.status || '').toLowerCase();

        // Verify payment link belongs to this user
        const notes = link?.notes || {};
        if (notes?.userId && String(notes.userId) !== String(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Payment link does not belong to you',
            });
        }

        // Check if payment is completed
        if (status !== 'paid' && status !== 'captured') {
            return res.status(200).json({
                success: true,
                data: { status: link?.status },
                message: 'Payment not completed yet',
            });
        }

        // Get payment details
        const paymentsRaw = link?.payments;
        const firstPayment = Array.isArray(paymentsRaw) ? paymentsRaw[0] : paymentsRaw;
        const paymentId = firstPayment?.payment_id || link?.payment_id;

        // Get podcast
        const podcast = await Podcast.findById(podcastId);
        if (!podcast) {
            return res.status(404).json({
                success: false,
                message: 'Podcast not found',
            });
        }

        // Check if already purchased
        let purchase = await PodcastPurchase.findOne({
            userId,
            podcastId,
        });

        if (!purchase) {
            // Create purchase record
            purchase = await PodcastPurchase.create({
                userId,
                podcastId,
                paymentId,
                orderId: paymentLinkId,
                purchasedAt: new Date(),
            });
        }

        // Send notification
        try {
            await sendNotification({
                userId,
                title: 'Podcast Purchased',
                message: `You have successfully purchased "${podcast.title}"`,
                type: 'podcast_purchase',
                data: { podcastId: String(podcastId) },
            });
        } catch (notificationError) {
            console.error('Notification error:', notificationError);
        }

        res.status(200).json({
            success: true,
            message: 'Podcast purchased successfully',
            data: {
                purchase,
                podcast: {
                    id: podcast._id,
                    title: podcast.title,
                    purchasedAt: purchase.purchasedAt,
                },
            },
        });
    } catch (error) {
        console.error('Confirm Podcast Payment Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm payment',
            error: error.message,
        });
    }
};

/**
 * Webhook handler for Razorpay payment events
 * POST /api/podcasts/webhook/razorpay
 */
export const handlePodcastPaymentWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const isValidWebhook = verifyRazorpayWebhookSignature(req.body, signature);

        if (!isValidWebhook) {
            return res.status(401).json({
                success: false,
                message: 'Invalid webhook signature',
            });
        }

        const { event, payload } = req.body;

        if (!event || !payload) {
            return res.status(400).json({
                success: false,
                message: 'Invalid webhook payload',
            });
        }

        // Handle different payment events
        if (event === 'payment_link.paid' || event === 'payment.captured') {
            const notes = payload?.notes || {};
            if (notes?.type === 'podcast') {
                const userId = notes?.userId;
                const podcastId = notes?.podcastId;
                const paymentId = payload?.id;

                if (!userId || !podcastId) {
                    return res.status(400).json({
                        success: false,
                        message: 'Missing userId or podcastId in webhook notes',
                    });
                }

                // Check if purchase already exists
                let purchase = await PodcastPurchase.findOne({
                    userId,
                    podcastId,
                });

                if (!purchase) {
                    purchase = await PodcastPurchase.create({
                        userId,
                        podcastId,
                        paymentId,
                        purchasedAt: new Date(),
                    });
                }

                // Send notification
                try {
                    const podcast = await Podcast.findById(podcastId);
                    await sendNotification({
                        userId,
                        title: 'Podcast Purchased',
                        message: `You have successfully purchased "${podcast?.title}"`,
                        type: 'podcast_purchase',
                        data: { podcastId: String(podcastId) },
                    });
                } catch (notificationError) {
                    console.error('Webhook notification error:', notificationError);
                }
            }
        }

        res.status(200).json({
            success: true,
            message: 'Webhook processed',
        });
    } catch (error) {
        console.error('Podcast Webhook Error:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: error.message,
        });
    }
};
