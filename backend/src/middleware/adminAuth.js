import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Admin from '../models/admin.models.js';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

/**
 * Admin middleware for admin panel routes.
 * Accepts either:
 * 1) Valid admin JWT (Authorization: Bearer <token> or adminToken cookie), or
 * 2) Valid X-Admin-API-Key header.
 *
 * API key comparison uses constant-time checks to reduce timing attacks.
 */
export const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const cookieToken = req.cookies?.adminToken;
    const jwtToken = bearerToken || cookieToken;

    if (jwtToken) {
      try {
        const decoded = jwt.verify(jwtToken, ADMIN_JWT_SECRET);
        const admin = await Admin.findById(decoded.id).select('-password');
        if (admin && admin.isActive) {
          req.admin = admin;
          return next();
        }
      } catch {
        // Fall back to API-key auth below.
      }
    }

    const apiKeyRaw = req.headers['x-admin-api-key'];
    const apiKey = typeof apiKeyRaw === 'string' ? apiKeyRaw.trim() : '';
    const adminApiKey = (process.env.ADMIN_API_KEY || '').trim();

    if (!adminApiKey) {
      console.error('ADMIN_API_KEY is not set in environment variables');
      return res.status(500).json({ success: false, message: 'Server misconfiguration' });
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'Admin API key required. Include X-Admin-API-Key header.'
      });
    }

    const keyBuffer = Buffer.from(apiKey);
    const expectedBuffer = Buffer.from(adminApiKey);
    if (keyBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(keyBuffer, expectedBuffer)) {
      return res.status(403).json({ success: false, message: 'Invalid admin API key' });
    }

    // API key is the shared credential — allow access.
    // Individual admin identity is not required for API key auth.
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Admin authentication failed'
    });
  }
};
