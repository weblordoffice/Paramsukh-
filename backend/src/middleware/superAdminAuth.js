import jwt from 'jsonwebtoken';
import Admin from '../models/admin.models.js';

/**
 * Super admin middleware — requires admin JWT with role 'super_admin'.
 * Unlike protectAdmin which accepts any admin, this only allows super admins.
 * Must be used AFTER protectAdmin or adminAuth middleware.
 */
export const superAdminAuth = async (req, res, next) => {
    try {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized. Admin authentication required.'
            });
        }

        if (req.admin.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Super admin privileges required.'
            });
        }

        next();
    } catch (error) {
        console.error('Super admin auth error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authorization check failed'
        });
    }
};
