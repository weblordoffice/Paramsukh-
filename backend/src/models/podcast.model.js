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
    // Source: YouTube or Local Upload
    source: {
        type: String,
        enum: ['youtube', 'local'],
        required: [true, 'Please select source (youtube or local)'],
        default: 'local',
    },
    youtubeUrl: {
        type: String,
        trim: true,
        // Required only if source is 'youtube'
    },
    videoUrl: {
        type: String,
        // Required only if source is 'local'
        trim: true,
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
    // Access Control
    accessType: {
        type: String,
        enum: ['free', 'membership', 'paid'],
        default: 'free',
        required: [true, 'Please select access type'],
    },
    // For membership access type
    requiredMemberships: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MembershipPlan',
        }
    ],
    // For paid access type
    price: {
        type: Number,
        // Required only if accessType is 'paid'
        min: [0, 'Price cannot be negative'],
    },
    currencyCode: {
        type: String,
        default: 'INR',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Validate that YouTube URL is provided when source is youtube
podcastSchema.pre('save', function(next) {
    if (this.source === 'youtube') {
        this.accessType = 'free';
        this.price = 0;
        this.requiredMemberships = [];
        this.videoUrl = '';
    } else if (this.source === 'local') {
        this.youtubeUrl = '';
    }

    if (this.source === 'youtube' && !this.youtubeUrl) {
        return next(new Error('YouTube URL is required when source is youtube'));
    }
    if (this.source === 'local' && !this.videoUrl) {
        return next(new Error('Video URL is required when source is local'));
    }
    if (this.accessType === 'membership' && (!this.requiredMemberships || this.requiredMemberships.length === 0)) {
        return next(new Error('At least one membership plan must be selected for membership access type'));
    }
    if (this.accessType === 'paid' && !this.price) {
        return next(new Error('Price is required for paid access type'));
    }
    this.updatedAt = Date.now();
    next();
});

podcastSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate() || {};
    const hasSet = !!update.$set;
    const target = hasSet ? update.$set : update;
    const source = target.source;

    if (source === 'youtube') {
        target.accessType = 'free';
        target.price = 0;
        target.requiredMemberships = [];
        target.videoUrl = '';
    } else if (source === 'local') {
        target.youtubeUrl = '';
    }

    target.updatedAt = Date.now();
    this.setUpdate(update);
    next();
});

export default mongoose.model('Podcast', podcastSchema);
