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
    excerpt: {
        type: String,
        trim: true,
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
    category: {
        type: String,
        enum: ['Spirituality', 'Mindfulness', 'Meditation', 'Scripture', 'Discourse', 'Wellness', 'Community', 'Other'],
        default: 'Other',
        trim: true,
    },
    tags: [{
        type: String,
        trim: true,
    }],
    readTime: {
        type: Number,
        default: 5,
        min: 1,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
});

blogSchema.index({ category: 1 });
blogSchema.index({ createdAt: -1 });
blogSchema.index({ title: 'text', content: 'text' });

blogSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    if (this.isModified('content') && !this.excerpt) {
        this.excerpt = this.content.replace(/<[^>]*>/g, '').slice(0, 200) + (this.content.length > 200 ? '...' : '');
    }
    if (!this.readTime && this.content) {
        const wordCount = this.content.split(/\s+/).length;
        this.readTime = Math.max(1, Math.ceil(wordCount / 200));
    }
    next();
});

blogSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate() || {};
    const hasSet = !!update.$set;
    const target = hasSet ? update.$set : update;
    target.updatedAt = Date.now();
    next();
});

blogSchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
        delete ret.__v;
        if (ret.deletedAt === null) delete ret.deletedAt;
        return ret;
    },
});

export default mongoose.model('Blog', blogSchema);
