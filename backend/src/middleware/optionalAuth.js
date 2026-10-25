import jwt from 'jsonwebtoken';
import { User } from '../models/user.models.js';

/**
 * Populates req.user when a valid bearer token / cookie is present, but never
 * rejects the request. Used by public course pages that adapt their payload for
 * signed-in users.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = req.cookies?.token || '';
    }

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return next();

    const user = await User.findById(decoded.id);
    if (!user) return next();

    if (decoded.v !== undefined && user.tokenVersion !== undefined && decoded.v < user.tokenVersion) {
      return next();
    }

    req.user = user;
    return next();
  } catch {
    return next();
  }
};

export default optionalAuth;
