import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Can be anonymous or non-logged in user technically, but usually logged in
    },
    userName: {
        type: String, // Snapshot of name at time of donation
        required: true
    },
    phone: {
        type: String
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    status: {
        type: String,
        enum: ['initiated', 'completed', 'failed'],
        default: 'initiated'
    },
    paymentMethod: {
        type: String,
        enum: ['UPI', 'card', 'netbanking', 'wallet'],
        default: 'UPI'
    },
    transactionId: {
        type: String, // From payment gateway/UPI
        unique: true,
        sparse: true
    },
    message: {
        type: String,
        trim: true,
        maxLength: 500
    },
    isAnonymous: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes for reporting
donationSchema.index({ createdAt: -1 });
donationSchema.index({ status: 1 });
donationSchema.index({ userId: 1 });

export const Donation = mongoose.model('Donation', donationSchema);
