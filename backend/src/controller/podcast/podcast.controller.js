import Podcast from '../../models/podcast.model.js';
import PodcastPurchase from '../../models/podcastPurchase.model.js';
import { UserMembership } from '../../models/userMembership.models.js';

const stripMediaUrls = (podcastDoc) => {
    const podcast = podcastDoc.toObject ? podcastDoc.toObject() : { ...podcastDoc };
    delete podcast.videoUrl;
    delete podcast.youtubeUrl;
    return podcast;
};

// Utility function to check if user can access podcast
export const canUserAccessPodcast = async (userId, podcastId) => {
    try {
        const podcast = await Podcast.findById(podcastId);
        if (!podcast) return { canAccess: false, reason: 'Podcast not found' };

        // Free podcasts are accessible to everyone
        if (podcast.accessType === 'free') {
            return { canAccess: true, reason: 'Free podcast' };
        }

        // If no userId, can't have paid or membership access
        if (!userId) {
            return { canAccess: false, reason: 'Authentication required' };
        }

        // Check membership access
        if (podcast.accessType === 'membership') {
            const userMembership = await UserMembership.findOne({
                userId,
                status: 'active',
                endDate: { $gte: new Date() }
            }).populate('planId');

            if (!userMembership || !userMembership.planId) {
                return { canAccess: false, reason: 'No active membership' };
            }

            const planId = userMembership.planId._id.toString();
            const hasPlan = podcast.requiredMemberships.some(
                (id) => id.toString() === planId
            );

            if (!hasPlan) {
                return { canAccess: false, reason: 'Membership plan does not include access' };
            }

            return { canAccess: true, reason: 'Membership access' };
        }

        // Check paid access
        if (podcast.accessType === 'paid') {
            const purchase = await PodcastPurchase.findOne({
                userId,
                podcastId
            });

            if (!purchase) {
                return { canAccess: false, reason: 'Podcast must be purchased' };
            }

            return { canAccess: true, reason: 'Paid access' };
        }

        return { canAccess: false, reason: 'Unknown access type' };
    } catch (error) {
        console.error('Access check error:', error);
        return { canAccess: false, reason: 'Error checking access' };
    }
};

// Create a new podcast
export const createPodcast = async (req, res) => {
    try {
        const { title, description, host, videoUrl, thumbnailUrl, duration, category, source, youtubeUrl, accessType, requiredMemberships, price, currencyCode } = req.body;
        const resolvedSource = source || 'local';
        const normalizedAccessType = resolvedSource === 'youtube' ? 'free' : (accessType || 'free');

        // Validation
        if (resolvedSource === 'youtube' && !youtubeUrl) {
            return res.status(400).json({
                success: false,
                message: 'YouTube URL is required when source is youtube',
            });
        }

        if (resolvedSource === 'local' && !videoUrl) {
            return res.status(400).json({
                success: false,
                message: 'Video URL is required when source is local',
            });
        }

        if (normalizedAccessType === 'membership' && (!requiredMemberships || requiredMemberships.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'At least one membership plan must be selected',
            });
        }

        if (normalizedAccessType === 'paid' && !price) {
            return res.status(400).json({
                success: false,
                message: 'Price is required for paid access type',
            });
        }

        const podcastData = {
            title,
            description,
            host,
            thumbnailUrl,
            duration,
            category,
            source: resolvedSource,
            accessType: normalizedAccessType,
            currencyCode: currencyCode || 'INR',
        };

        if (resolvedSource === 'youtube') {
            podcastData.youtubeUrl = youtubeUrl;
            podcastData.price = 0;
            podcastData.requiredMemberships = [];
        } else {
            podcastData.videoUrl = videoUrl;
        }

        if (normalizedAccessType === 'membership') {
            podcastData.requiredMemberships = requiredMemberships;
        }

        if (normalizedAccessType === 'paid') {
            podcastData.price = price;
        }

        const podcast = await Podcast.create(podcastData);

        res.status(201).json({
            success: true,
            message: 'Podcast created successfully',
            data: { podcast },
        });
    } catch (error) {
        console.error('Create Podcast Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create podcast',
            error: error.message,
        });
    }
};

// Get all free podcasts (public endpoint)
export const getAllPodcasts = async (req, res) => {
    try {
        const { category } = req.query;
        let query = { accessType: 'free' }; // Only return free podcasts

        if (category && category !== 'All') {
            query.category = category;
        }

        const podcasts = await Podcast.find(query)
            .populate('requiredMemberships', 'title slug badgeColor')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: podcasts.length,
            data: { podcasts },
        });
    } catch (error) {
        console.error('Get Podcasts Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve podcasts',
            error: error.message,
        });
    }
};

// Get all accessible podcasts for authenticated user (free + membership + purchased)
export const getUserAccessiblePodcasts = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const { category } = req.query;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        // Get user's active membership
        const userMembership = await UserMembership.findOne({
            userId,
            status: 'active',
            endDate: { $gte: new Date() }
        }).populate('planId');

        // Get user's purchased podcasts
        const userPurchases = await PodcastPurchase.find({ userId }).select('podcastId');
        const purchasedPodcastIds = new Set(userPurchases.map((p) => p.podcastId.toString()));

        let query = {};

        if (category && category !== 'All') {
            query.category = category;
        }

        const podcasts = await Podcast.find(query)
            .populate('requiredMemberships', 'title slug badgeColor')
            .sort({ createdAt: -1 });

        const activePlanId = userMembership?.planId?._id?.toString();

        const catalog = podcasts.map((podcastDoc) => {
            const podcast = podcastDoc.toObject();

            let canAccess = false;
            let accessReason = 'Unknown access type';

            if (podcast.accessType === 'free') {
                canAccess = true;
                accessReason = 'Free podcast';
            } else if (podcast.accessType === 'membership') {
                const requiredPlanIds = (podcast.requiredMemberships || []).map((id) => id.toString());
                const hasMembershipAccess = !!activePlanId && requiredPlanIds.includes(activePlanId);
                canAccess = hasMembershipAccess;
                accessReason = hasMembershipAccess
                    ? 'Membership access'
                    : 'Membership plan does not include access';
            } else if (podcast.accessType === 'paid') {
                const hasPurchase = purchasedPodcastIds.has(podcast._id.toString());
                canAccess = hasPurchase;
                accessReason = hasPurchase ? 'Paid access' : 'Podcast must be purchased';
            }

            if (!canAccess) {
                delete podcast.videoUrl;
                delete podcast.youtubeUrl;
            }

            return {
                ...podcast,
                canAccess,
                accessReason,
            };
        });

        res.status(200).json({
            success: true,
            count: catalog.length,
            data: { podcasts: catalog },
        });
    } catch (error) {
        console.error('Get User Accessible Podcasts Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve podcasts',
            error: error.message,
        });
    }
};

// Get single podcast details
export const getPodcastDetails = async (req, res) => {
    try {
        const podcast = await Podcast.findById(req.params.id)
            .populate('requiredMemberships', 'title slug badgeColor price');

        if (!podcast) {
            return res.status(404).json({
                success: false,
                message: 'Podcast not found',
            });
        }

        // Check access for authenticated users
        const userId = req.user?.id || req.user?._id;
        const accessInfo = await canUserAccessPodcast(userId, podcast._id);

        const safePodcast = accessInfo.canAccess ? podcast : stripMediaUrls(podcast);

        res.status(200).json({
            success: true,
            data: { podcast: safePodcast, accessInfo },
        });
    } catch (error) {
        console.error('Get Podcast Details Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve podcast details',
            error: error.message,
        });
    }
};

// Get podcast with access check for streaming
export const getPodcastForStream = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const podcastId = req.params.id;

        const podcast = await Podcast.findById(podcastId);

        if (!podcast) {
            return res.status(404).json({
                success: false,
                message: 'Podcast not found',
            });
        }

        const accessInfo = await canUserAccessPodcast(userId, podcastId);

        if (!accessInfo.canAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                reason: accessInfo.reason,
            });
        }

        res.status(200).json({
            success: true,
            data: { podcast, accessInfo },
        });
    } catch (error) {
        console.error('Get Podcast For Stream Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve podcast',
            error: error.message,
        });
    }
};

// Update podcast
export const updatePodcast = async (req, res) => {
    try {
        let podcast = await Podcast.findById(req.params.id);

        if (!podcast) {
            return res.status(404).json({
                success: false,
                message: 'Podcast not found',
            });
        }

        const { source, youtubeUrl, videoUrl, accessType, requiredMemberships, price } = req.body;
        const resolvedSource = source || podcast.source || 'local';
        const normalizedAccessType = resolvedSource === 'youtube' ? 'free' : (accessType || podcast.accessType || 'free');
        const updatePayload = { ...req.body, source: resolvedSource, accessType: normalizedAccessType };

        // Validation
        if (resolvedSource === 'youtube' && !youtubeUrl) {
            return res.status(400).json({
                success: false,
                message: 'YouTube URL is required when source is youtube',
            });
        }

        if (resolvedSource === 'local' && !videoUrl) {
            return res.status(400).json({
                success: false,
                message: 'Video URL is required when source is local',
            });
        }

        if (normalizedAccessType === 'membership' && (!requiredMemberships || requiredMemberships.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'At least one membership plan must be selected',
            });
        }

        if (normalizedAccessType === 'paid' && !price) {
            return res.status(400).json({
                success: false,
                message: 'Price is required for paid access type',
            });
        }

        if (resolvedSource === 'youtube') {
            updatePayload.accessType = 'free';
            updatePayload.price = 0;
            updatePayload.requiredMemberships = [];
            updatePayload.videoUrl = '';
        } else {
            updatePayload.youtubeUrl = '';
        }

        podcast = await Podcast.findByIdAndUpdate(req.params.id, updatePayload, {
            new: true,
            runValidators: true,
            useFindAndModify: false,
        }).populate('requiredMemberships', 'title slug badgeColor');

        res.status(200).json({
            success: true,
            message: 'Podcast updated successfully',
            data: { podcast },
        });
    } catch (error) {
        console.error('Update Podcast Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update podcast',
            error: error.message,
        });
    }
};

// Delete podcast
export const deletePodcast = async (req, res) => {
    try {
        const podcast = await Podcast.findById(req.params.id);

        if (!podcast) {
            return res.status(404).json({
                success: false,
                message: 'Podcast not found',
            });
        }

        await podcast.deleteOne();

        // Also delete any purchases associated with this podcast
        await PodcastPurchase.deleteMany({ podcastId: podcast._id });

        res.status(200).json({
            success: true,
            message: 'Podcast deleted successfully',
        });
    } catch (error) {
        console.error('Delete Podcast Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete podcast',
            error: error.message,
        });
    }
};

// Get user's podcast purchases
export const getUserPodcastPurchases = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const purchases = await PodcastPurchase.find({ userId })
            .populate('podcastId', 'title thumbnailUrl duration category accessType price')
            .sort({ purchasedAt: -1 });

        res.status(200).json({
            success: true,
            count: purchases.length,
            data: { purchases },
        });
    } catch (error) {
        console.error('Get User Podcast Purchases Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve purchases',
            error: error.message,
        });
    }
};

// Check if user has purchased a podcast
export const checkPodcastPurchaseStatus = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const podcastId = req.params.podcastId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const purchase = await PodcastPurchase.findOne({ userId, podcastId });

        res.status(200).json({
            success: true,
            data: {
                purchased: !!purchase,
                purchaseDate: purchase?.purchasedAt || null,
            },
        });
    } catch (error) {
        console.error('Check Purchase Status Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check purchase status',
            error: error.message,
        });
    }
};

// Admin: get all podcasts regardless of access type
export const getAdminAllPodcasts = async (req, res) => {
    try {
        const { category } = req.query;
        const query = {};

        if (category && category !== 'All') {
            query.category = category;
        }

        const podcasts = await Podcast.find(query)
            .populate('requiredMemberships', 'title slug badgeColor')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: podcasts.length,
            data: { podcasts },
        });
    } catch (error) {
        console.error('Get Admin Podcasts Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve admin podcasts',
            error: error.message,
        });
    }
};
