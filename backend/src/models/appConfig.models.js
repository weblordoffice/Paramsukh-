
import mongoose from 'mongoose';

const appConfigSchema = new mongoose.Schema({
    // Unique identifier for the configuration document (we might have only one main config or multiple)
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // The configuration data
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },

    description: String
}, {
    timestamps: true
});

export const AppConfig = mongoose.model('AppConfig', appConfigSchema);
