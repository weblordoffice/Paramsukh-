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
    },
    businessHours: {
        monday: { start: { type: String, default: "09:00" }, end: { type: String, default: "18:00" }, isActive: { type: Boolean, default: true } },
        tuesday: { start: { type: String, default: "09:00" }, end: { type: String, default: "18:00" }, isActive: { type: Boolean, default: true } },
        wednesday: { start: { type: String, default: "09:00" }, end: { type: String, default: "18:00" }, isActive: { type: Boolean, default: true } },
        thursday: { start: { type: String, default: "09:00" }, end: { type: String, default: "18:00" }, isActive: { type: Boolean, default: true } },
        friday: { start: { type: String, default: "09:00" }, end: { type: String, default: "18:00" }, isActive: { type: Boolean, default: true } },
        saturday: { start: { type: String, default: "10:00" }, end: { type: String, default: "16:00" }, isActive: { type: Boolean, default: false } },
        sunday: { start: { type: String, default: "10:00" }, end: { type: String, default: "16:00" }, isActive: { type: Boolean, default: false } }
    },
    intervalMinutes: {
        type: Number,
        default: 60 // Slot length in minutes
    }
}, {
    timestamps: true
});

export default mongoose.model('CounselingService', counselingServiceSchema);
