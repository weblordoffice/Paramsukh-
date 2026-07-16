import mongoose from 'mongoose';

const podcastFavoriteSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    podcasts: [{
        podcast: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Podcast',
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

podcastFavoriteSchema.index({ user: 1, 'podcasts.podcast': 1 });

podcastFavoriteSchema.methods.addPodcast = async function(podcastId) {
    const exists = this.podcasts.some(item => item.podcast.toString() === podcastId.toString());
    if (!exists) {
        this.podcasts.push({ podcast: podcastId });
        await this.save();
    }
    return this;
};

podcastFavoriteSchema.methods.removePodcast = async function(podcastId) {
    this.podcasts = this.podcasts.filter(item => item.podcast.toString() !== podcastId.toString());
    await this.save();
    return this;
};

const PodcastFavorite = mongoose.model('PodcastFavorite', podcastFavoriteSchema);

export default PodcastFavorite;
