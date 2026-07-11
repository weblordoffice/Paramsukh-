import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please enter blog title'],
        trim: true,
    },
    content: {
        type: String,
        required: [true, 'Please enter blog content'],
    },
    imageUrl: {
        type: String,
        trim: true,
    },
    author: {
        type: String,
        default: 'Admin',
        trim: true,
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

blogSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

blogSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate() || {};
    const hasSet = !!update.$set;
    const target = hasSet ? update.$set : update;
    target.updatedAt = Date.now();
    next();
});

export default mongoose.model('Blog', blogSchema);
