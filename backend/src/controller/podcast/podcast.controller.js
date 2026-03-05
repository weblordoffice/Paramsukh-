import Podcast from '../../models/podcast.model.js';

// Create a new podcast
export const createPodcast = async (req, res) => {
    try {
        const { title, description, host, videoUrl, thumbnailUrl, duration, category } = req.body;

        const podcast = await Podcast.create({
            title,
            description,
            host,
            videoUrl,
            thumbnailUrl,
            duration,
            category,
        });

        res.status(201).json({
            success: true,
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

// Get all podcasts
export const getAllPodcasts = async (req, res) => {
    try {
        const { category } = req.query;
        let query = {};

        if (category && category !== 'All') {
            query.category = category;
        }

        const podcasts = await Podcast.find(query).sort({ createdAt: -1 });

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

// Get single podcast details
export const getPodcastDetails = async (req, res) => {
    try {
        const podcast = await Podcast.findById(req.params.id);

        if (!podcast) {
            return res.status(404).json({
                success: false,
                message: 'Podcast not found',
            });
        }

        res.status(200).json({
            success: true,
            data: { podcast },
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

        podcast = await Podcast.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
            useFindAndModify: false,
        });

        res.status(200).json({
            success: true,
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
