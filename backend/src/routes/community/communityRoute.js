import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { contentCreationLimiter, communityPostLimiter, communityCommentLimiter, communityLikeLimiter, communityVoteLimiter } from '../../middleware/rateLimiter.js';
import { validateCreatePost, validateCreateComment, validateMongoIdParams } from '../../middleware/validators.js';
import { sanitizePostContent, sanitizeCommentContent } from '../../middleware/sanitizeInput.js';
import {
  checkCommunityAccess,
  getMyGroups,
  getGroupPosts,
  getAllFeedPosts,
  createPost,
  togglePostLike,
  togglePostVote,
  resolveQuestion,
  acceptAnswer,
  getLeaderboard,
  getMentors,
  getMentorProfile,
  getMentorMe,
  getMentorQuestions,
  getPostComments,
  addComment,
  toggleCommentLike,
  deletePost,
  deleteComment
} from '../../controller/community/community.controller.js';
import { getAllPosts, deletePostAdmin, togglePinPost, toggleBlockPost, setUserPostingBlock, createPostAdmin, getAdminGroups, getPostCommentsAdmin, deleteCommentAdmin, getGeneralGroup, updateGeneralGroup, resolveQuestionAdmin, acceptAnswerAdmin, getLeaderboardAdmin, getPointEventsAdmin, getAdminMentors, createMentorAdmin, updateMentorAdmin, deactivateMentorAdmin } from '../../controller/community/admin.community.controller.js';
import { runScheduledCleanup } from '../../controller/community/communityCleanup.controller.js';

const router = express.Router();

// Admin routes
router.get('/all', adminAuth, getAllPosts);
router.delete('/posts/:postId/admin', adminAuth, validateMongoIdParams('postId'), deletePostAdmin);
router.patch('/posts/:postId/pin', adminAuth, validateMongoIdParams('postId'), togglePinPost);
router.patch('/posts/:postId/block', adminAuth, validateMongoIdParams('postId'), toggleBlockPost);
router.post('/admin/users/:userId/posting-block', adminAuth, validateMongoIdParams('userId'), setUserPostingBlock);
router.post('/admin/posts', adminAuth, communityPostLimiter, sanitizePostContent, validateCreatePost, createPostAdmin);
router.get('/admin/groups', adminAuth, getAdminGroups);
router.get('/admin/groups/general', adminAuth, getGeneralGroup);
router.patch('/admin/groups/general', adminAuth, updateGeneralGroup);
router.get('/admin/posts/:postId/comments', adminAuth, validateMongoIdParams('postId'), getPostCommentsAdmin);
router.patch('/admin/posts/:postId/resolve', adminAuth, validateMongoIdParams('postId'), resolveQuestionAdmin);
router.patch('/admin/posts/:postId/accept-answer', adminAuth, validateMongoIdParams('postId'), acceptAnswerAdmin);
router.get('/admin/leaderboard', adminAuth, getLeaderboardAdmin);
router.get('/admin/leaderboard/events', adminAuth, getPointEventsAdmin);
router.get('/admin/mentors', adminAuth, getAdminMentors);
router.post('/admin/mentors', adminAuth, createMentorAdmin);
router.patch('/admin/mentors/:mentorId', adminAuth, validateMongoIdParams('mentorId'), updateMentorAdmin);
router.delete('/admin/mentors/:mentorId', adminAuth, validateMongoIdParams('mentorId'), deactivateMentorAdmin);
router.delete('/comments/:commentId/admin', adminAuth, validateMongoIdParams('commentId'), deleteCommentAdmin);
router.get('/admin/cleanup-expired', adminAuth, runScheduledCleanup);  // Scheduled cleanup endpoint

// All other community routes require authentication
router.use(protectedRoutes);

// ========================================
// Community Access
// ========================================
router.get('/check-access', checkCommunityAccess);

// ========================================
// Leaderboard
// ========================================
router.get('/leaderboard', getLeaderboard);

// ========================================
// Mentors
// ========================================
router.get('/mentors', getMentors);
router.get('/mentor/me', getMentorMe);
router.get('/mentor/questions', getMentorQuestions);
router.get('/mentors/:userId', validateMongoIdParams('userId'), getMentorProfile);

// ========================================
// Groups
// ========================================
router.get('/my-groups', getMyGroups);
router.get('/feed', getAllFeedPosts);
router.get('/groups/:groupId/posts', validateMongoIdParams('groupId'), getGroupPosts);
router.post('/groups/:groupId/posts', validateMongoIdParams('groupId'), communityPostLimiter, sanitizePostContent, validateCreatePost, createPost);

// ========================================
// Posts
// ========================================
router.post('/posts/:postId/like', validateMongoIdParams('postId'), communityLikeLimiter, togglePostLike);
router.post('/posts/:postId/vote', validateMongoIdParams('postId'), communityVoteLimiter, togglePostVote);
router.patch('/posts/:postId/resolve', validateMongoIdParams('postId'), resolveQuestion);
router.patch('/posts/:postId/accept-answer', validateMongoIdParams('postId'), acceptAnswer);
router.delete('/posts/:postId', validateMongoIdParams('postId'), deletePost);

// ========================================
// Comments
// ========================================
router.get('/posts/:postId/comments', validateMongoIdParams('postId'), getPostComments);
router.post('/posts/:postId/comments', validateMongoIdParams('postId'), communityCommentLimiter, sanitizeCommentContent, validateCreateComment, addComment);
router.post('/comments/:commentId/like', validateMongoIdParams('commentId'), communityLikeLimiter, toggleCommentLike);
router.delete('/comments/:commentId', validateMongoIdParams('commentId'), deleteComment);

export default router;
