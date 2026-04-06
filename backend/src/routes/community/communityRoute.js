import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { contentCreationLimiter, communityPostLimiter, communityCommentLimiter, communityLikeLimiter } from '../../middleware/rateLimiter.js';
import { validateCreatePost, validateCreateComment } from '../../middleware/validators.js';
import { sanitizePostContent, sanitizeCommentContent } from '../../middleware/sanitizeInput.js';
import {
  checkCommunityAccess,
  getMyGroups,
  getGroupPosts,
  createPost,
  togglePostLike,
  getPostComments,
  addComment,
  toggleCommentLike,
  deletePost
} from '../../controller/community/community.controller.js';
import { getAllPosts, deletePostAdmin, togglePinPost } from '../../controller/community/admin.community.controller.js';
import { runScheduledCleanup } from '../../controller/community/communityCleanup.controller.js';

const router = express.Router();

// Admin routes
router.get('/all', adminAuth, getAllPosts);
router.delete('/posts/:postId/admin', adminAuth, deletePostAdmin);
router.patch('/posts/:postId/pin', adminAuth, togglePinPost);
router.get('/admin/cleanup-expired', adminAuth, runScheduledCleanup);  // Scheduled cleanup endpoint

// All other community routes require authentication
router.use(protectedRoutes);

// ========================================
// Community Access
// ========================================
router.get('/check-access', checkCommunityAccess);

// ========================================
// Groups
// ========================================
router.get('/my-groups', getMyGroups);
router.get('/groups/:groupId/posts', getGroupPosts);
router.post('/groups/:groupId/posts', communityPostLimiter, sanitizePostContent, validateCreatePost, createPost);

// ========================================
// Posts
// ========================================
router.post('/posts/:postId/like', communityLikeLimiter, togglePostLike);
router.delete('/posts/:postId', deletePost);

// ========================================
// Comments
// ========================================
router.get('/posts/:postId/comments', getPostComments);
router.post('/posts/:postId/comments', communityCommentLimiter, sanitizeCommentContent, validateCreateComment, addComment);
router.post('/comments/:commentId/like', communityLikeLimiter, toggleCommentLike);

export default router;
