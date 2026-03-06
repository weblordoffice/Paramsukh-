import crypto from 'crypto';

/**
 * Admin middleware - API key authentication for admin panel.
 * Uses constant-time comparison to prevent timing attacks.
 */
export const adminAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-admin-api-key'];
    const adminApiKey = process.env.ADMIN_API_KEY;

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

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Admin authentication failed'
    });
  }
};
