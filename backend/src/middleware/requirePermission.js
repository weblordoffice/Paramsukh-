import { getAdminFromRequest, isValidAdminApiKey } from './adminAuth.js';

/**
 * Restrict an admin route to one or more permissions.
 *
 * - Requests authenticated with the server-side ADMIN_API_KEY are trusted.
 * - super_admin always passes.
 * - Regular admins pass when they hold at least one listed permission.
 *
 * Can run after adminAuth (reusing req.admin / req.isAdminApiKey) or standalone.
 */
export const requirePermission = (...permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.admin && !req.isAdminApiKey) {
        const admin = await getAdminFromRequest(req);
        if (admin) {
          req.admin = admin;
        } else if (isValidAdminApiKey(req)) {
          req.isAdminApiKey = true;
        }
      }

      if (req.isAdminApiKey) return next();

      if (!req.admin) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
      }

      if (req.admin.role === 'super_admin') return next();

      if (permissions.includes('super_admin')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Super admin role required.'
        });
      }

      const adminPermissions = req.admin.permissions || [];
      const allowed = permissions.some((permission) => adminPermissions.includes(permission));

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action'
        });
      }

      return next();
    } catch (error) {
      console.error('Admin permission error:', error);
      return res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};
