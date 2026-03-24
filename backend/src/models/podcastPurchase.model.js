import mongoose from 'mongoose';

const podcastPurchaseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
    },
    podcastId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Podcast',
        required: [true, 'Podcast ID is required'],
    },
    orderId: {
        type: String,
        // Razorpay order ID reference
    },
    paymentId: {
        type: String,
        // Razorpay payment ID
    },
    purchasedAt: {
        type: Date,
        default: Date.now,
    },
},
{ timestamps: true }
);

// Create unique index so a user can only purchase a podcast once
podcastPurchaseSchema.index({ userId: 1, podcastId: 1 }, { unique: true });

export default mongoose.model('PodcastPurchase', podcastPurchaseSchema);
