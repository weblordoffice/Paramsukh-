import { getAdminFromRequest, isValidAdminApiKey } from './adminAuth.js';
import { Post, Comment } from '../models/community.models.js';
import { AssessmentAttempt } from '../models/assessmentAttempt.models.js';
import { VivaApplication } from '../models/vivaApplication.models.js';

const SCOPE_LABELS = {
  manage_courses: 'course',
  manage_events: 'event',
  manage_community: 'community',
  manage_mentor_groups: 'mentor group',
};

const resolveAdmin = async (req) => {
  if (req.admin || req.isAdminApiKey) return;
  const admin = await getAdminFromRequest(req);
  if (admin) {
    req.admin = admin;
  } else if (isValidAdminApiKey(req)) {
    req.isAdminApiKey = true;
  }
};

/**
 * Returns null when the admin is unrestricted for this permission.
 * Returns an array of allowed resource IDs when scope is "selected".
 */
export const getScopedIds = (admin, permission) => {
  if (!admin || admin.role === 'super_admin') return null;
  const scope = admin.permissionScopes?.[permission];
  if (!scope || scope.mode !== 'selected') return null;
  return (scope.ids || []).map((id) => String(id));
};

export const isScopeRestricted = (admin, permission) =>
  getScopedIds(admin, permission) !== null;

export const canAccessScopedId = (admin, permission, id) => {
  const ids = getScopedIds(admin, permission);
  if (ids === null) return true;
  if (id === undefined || id === null || id === '') return false;
  return ids.includes(String(id));
};

export const scopeQuery = (admin, permission, field = '_id') => {
  const ids = getScopedIds(admin, permission);
  return ids === null ? null : { [field]: { $in: ids } };
};

const denyScope = (res, permission) => res.status(403).json({
  success: false,
  message: `You do not have access to this ${SCOPE_LABELS[permission] || 'resource'}`,
});

const ensureAdmin = async (req, res) => {
  await resolveAdmin(req);
  if (req.isAdminApiKey) return true;
  if (!req.admin) {
    res.status(401).json({ success: false, message: 'Not authorized' });
    return false;
  }
  return true;
};

/**
 * Allows the request only when the target resource ID is in the admin's scope.
 * Run after adminAuth + requirePermission.
 */
export const requireResourceScope = (permission, paramName = 'id', getResourceId = null) => {
  return async (req, res, next) => {
    try {
      if (!(await ensureAdmin(req, res))) return undefined;
      if (req.isAdminApiKey || req.admin.role === 'super_admin') return next();

      const ids = getScopedIds(req.admin, permission);
      if (ids === null) return next();

      const resourceId = getResourceId ? getResourceId(req) : req.params?.[paramName];
      if (!canAccessScopedId(req.admin, permission, resourceId)) {
        return denyScope(res, permission);
      }

      return next();
    } catch (error) {
      console.error('Permission scope error:', error);
      return res.status(500).json({ success: false, message: 'Permission scope check failed' });
    }
  };
};

/**
 * Block creation when the admin is limited to selected resources.
 * Creating a new resource would put it outside their existing scope.
 */
export const requireAllPermissionScope = (permission) => {
  return async (req, res, next) => {
    try {
      if (!(await ensureAdmin(req, res))) return undefined;
      if (req.isAdminApiKey || req.admin.role === 'super_admin') return next();

      if (getScopedIds(req.admin, permission) !== null) {
        return res.status(403).json({
          success: false,
          message: `This admin can manage selected ${SCOPE_LABELS[permission] || 'resources'} only. Set the permission scope to All to allow creating new ones.`,
        });
      }

      return next();
    } catch (error) {
      console.error('Permission scope error:', error);
      return res.status(500).json({ success: false, message: 'Permission scope check failed' });
    }
  };
};

export const requirePostScope = async (req, res, next) => {
  try {
    if (!(await ensureAdmin(req, res))) return undefined;
    if (req.isAdminApiKey || req.admin.role === 'super_admin') return next();
    if (getScopedIds(req.admin, 'manage_community') === null) return next();

    const post = await Post.findById(req.params.postId).select('groupId').lean();
    if (!post) return next();

    if (!canAccessScopedId(req.admin, 'manage_community', post.groupId)) {
      return denyScope(res, 'manage_community');
    }
    return next();
  } catch (error) {
    console.error('Post scope error:', error);
    return res.status(500).json({ success: false, message: 'Permission scope check failed' });
  }
};

export const requireCommentScope = async (req, res, next) => {
  try {
    if (!(await ensureAdmin(req, res))) return undefined;
    if (req.isAdminApiKey || req.admin.role === 'super_admin') return next();
    if (getScopedIds(req.admin, 'manage_community') === null) return next();

    const comment = await Comment.findById(req.params.commentId).select('postId').lean();
    if (!comment) return next();

    const post = await Post.findById(comment.postId).select('groupId').lean();
    if (!post) return next();

    if (!canAccessScopedId(req.admin, 'manage_community', post.groupId)) {
      return denyScope(res, 'manage_community');
    }
    return next();
  } catch (error) {
    console.error('Comment scope error:', error);
    return res.status(500).json({ success: false, message: 'Permission scope check failed' });
  }
};

export const requireAssessmentAttemptScope = async (req, res, next) => {
  try {
    if (!(await ensureAdmin(req, res))) return undefined;
    if (req.isAdminApiKey || req.admin.role === 'super_admin') return next();
    if (getScopedIds(req.admin, 'manage_courses') === null) return next();

    const attempt = await AssessmentAttempt.findById(req.params.attemptId).select('course').lean();
    if (!attempt) return next();

    if (!canAccessScopedId(req.admin, 'manage_courses', attempt.course)) {
      return denyScope(res, 'manage_courses');
    }
    return next();
  } catch (error) {
    console.error('Assessment attempt scope error:', error);
    return res.status(500).json({ success: false, message: 'Permission scope check failed' });
  }
};

export const requireVivaScope = async (req, res, next) => {
  try {
    if (!(await ensureAdmin(req, res))) return undefined;
    if (req.isAdminApiKey || req.admin.role === 'super_admin') return next();
    if (getScopedIds(req.admin, 'manage_courses') === null) return next();

    const viva = await VivaApplication.findById(req.params.vivaId).select('course').lean();
    if (!viva) return next();

    if (!canAccessScopedId(req.admin, 'manage_courses', viva.course)) {
      return denyScope(res, 'manage_courses');
    }
    return next();
  } catch (error) {
    console.error('Viva scope error:', error);
    return res.status(500).json({ success: false, message: 'Permission scope check failed' });
  }
};
