import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: false
    },
    role: {
        type: String,
        enum: ['super_admin', 'admin'],
        default: 'admin'
    },
    // Specific permissions for 'admin' role
    // 'super_admin' has all permissions implicitly
    permissions: [{
        type: String,
        enum: [
            'manage_users',
            'manage_courses',
            'manage_events',
            'manage_community',
            'manage_shop',
            'manage_orders',
            'manage_content', // videos, pdfs
            'manage_admins',  // only for super_admin usually, but can be delegated
            'view_analytics'
        ]
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Hash password only when set (Google-only admins have no password)
adminSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password (for legacy email/password; Google-only admins have no password)
adminSchema.methods.comparePassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

// Check permission
adminSchema.methods.hasPermission = function (permission) {
    if (this.role === 'super_admin') return true;
    return this.permissions.includes(permission);
};

const Admin = mongoose.model('Admin', adminSchema);

export default Admin;
