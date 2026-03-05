import mongoose from 'mongoose';

const counselingServiceSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    icon: {
        type: String, // Ionicons name
        default: 'help-buoy'
    },
    color: {
        type: String, // Hex color
        default: '#3B82F6'
    },
    bgColor: {
        type: String, // Background Hex color
        default: '#EFF6FF'
    },
    duration: {
        type: String, // Display string like "60 mins"
        required: true,
        default: "60 mins"
    },
    price: {
        type: Number,
        required: true,
        default: 0
    },
    isFree: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    counselorName: {
        type: String,
        default: 'Expert Counselor'
    }
}, {
    timestamps: true
});

export default mongoose.model('CounselingService', counselingServiceSchema);
