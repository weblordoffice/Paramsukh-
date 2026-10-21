import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Admin from '../models/admin.models.js';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

const getJwtToken = (req) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const cookieToken = req.cookies?.adminToken;
  return bearerToken || cookieToken || null;
};

/**
 * Resolve an active admin from a JWT in the request without writing a response.
 * Returns null when the request has no valid admin token.
 */
export const getAdminFromRequest = async (req) => {
  const jwtToken = getJwtToken(req);
  if (!jwtToken) return null;

  try {
    const decoded = jwt.verify(jwtToken, ADMIN_JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select('-password');
    if (admin && admin.isActive) return admin;
  } catch {
    // Invalid/expired token — caller decides how to respond.
  }

  return null;
};

/**
 * Constant-time check of the X-Admin-API-Key header against ADMIN_API_KEY.
 * Returns false when either side is missing.
 */
export const isValidAdminApiKey = (req) => {
  const apiKeyRaw = req.headers['x-admin-api-key'];
  const apiKey = typeof apiKeyRaw === 'string' ? apiKeyRaw.trim() : '';
  const adminApiKey = (process.env.ADMIN_API_KEY || '').trim();

  if (!apiKey || !adminApiKey) return false;

  const keyBuffer = Buffer.from(apiKey);
  const expectedBuffer = Buffer.from(adminApiKey);
  return keyBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(keyBuffer, expectedBuffer);
};

/**
 * Admin middleware for admin panel routes.
 * Accepts either:
 * 1) Valid admin JWT (Authorization: Bearer <token> or adminToken cookie), or
 * 2) Valid X-Admin-API-Key header.
 *
 * API key comparison uses constant-time checks to reduce timing attacks.
 * API-key requests are marked with req.isAdminApiKey so permission middleware
 * can treat the server-side shared secret as fully trusted.
 */
export const adminAuth = async (req, res, next) => {
  try {
    const admin = await getAdminFromRequest(req);
    if (admin) {
      req.admin = admin;
      return next();
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

    if (!isValidAdminApiKey(req)) {
      return res.status(403).json({ success: false, message: 'Invalid admin API key' });
    }

    // API key is the shared server-side credential — trusted for all permissions.
    // Individual admin identity is not available for API key auth.
    req.isAdminApiKey = true;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Admin authentication failed'
    });
  }
};
