import jwt from 'jsonwebtoken';
import Admin from '../models/admin.models.js';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

export const protectAdmin = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        else if (req.cookies.adminToken) {
            token = req.cookies.adminToken;
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized, no token' });
        }

        const decoded = jwt.verify(token, ADMIN_JWT_SECRET);

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

// Middleware to restrict access based on role or permissions
export const restrictTo = (...permissions) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        // Super Admin role has all access
        if (req.admin.role === 'super_admin') {
            return next();
        }

        // 'super_admin' permission string requires the actual role
        if (permissions.includes('super_admin')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Super admin role required.'
            });
        }

        // Check if admin has at least one of the required permissions (OR logic)
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
