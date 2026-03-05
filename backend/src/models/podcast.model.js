import mongoose from 'mongoose';

const podcastSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please enter podcast title'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Please enter podcast description'],
    },
    host: {
        type: String,
        required: [true, 'Please enter host name'],
    },
    videoUrl: {
        type: String,
        required: [true, 'Please provide video/audio URL'],
    },
    thumbnailUrl: {
        type: String,
        required: [true, 'Please provide thumbnail URL'],
    },
    duration: {
        type: String,
        default: '00:00',
    },
    category: {
        type: String,
        required: [true, 'Please select category'],
        enum: ['Meditation', 'Discourse', 'Scripture', 'Mindfulness', 'Mantra', 'Other'],
        default: 'Other',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model('Podcast', podcastSchema);
