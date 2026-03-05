import jwt from 'jsonwebtoken';
import Admin from '../models/admin.models.js';

export const protectAdmin = async (req, res, next) => {
    try {
        let token;

        // Check Authorization header first
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        // Fallback to cookie (optional, but good for admin panel web client)
        else if (req.cookies.adminToken) {
            token = req.cookies.adminToken;
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized, no token' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        const admin = await Admin.findById(decoded.id).select('-password');

        if (!admin) {
            return res.status(401).json({ success: false, message: 'Not authorized, admin not found' });
        }

        if (!admin.isActive) {
            return res.status(403).json({ success: false, message: 'Account is deactivated' });
        }

        req.admin = admin;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired' });
        }
        res.status(401).json({ success: false, message: 'Not authorized' });
    }
};

// Middleware to restrict access based on permissions
export const restrictTo = (...permissions) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        // Super Admin has all access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        // Check if admin has ANY of the required permissions (OR logic)
        // For stricter AND logic, change permissions.some to permissions.every
        // Usually admin routes might require one specific permission e.g. 'manage_users'
        const hasPermission = permissions.some(p => req.admin.permissions.includes(p));

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action'
            });
        }

        next();
    };
};
