import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import {
  requireResourceScope,
  requireAllPermissionScope,
  requirePostScope,
  requireCommentScope,
} from '../../middleware/permissionScope.js';
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
  getMentors,
  getMentorProfile,
  getMentorMe,
  getMentorQuestions,
  createMentorGroup,
  getMentorGroupMembers,
  addMentorGroupMembers,
  getMentorGroupCandidates,
  getPostComments,
  addComment,
  toggleCommentLike,
  deletePost,
  deleteComment
} from '../../controller/community/community.controller.js';
import { getAllPosts, deletePostAdmin, togglePinPost, toggleBlockPost, setUserPostingBlock, createPostAdmin, getAdminGroups, getPostCommentsAdmin, deleteCommentAdmin, getGeneralGroup, updateGeneralGroup, resolveQuestionAdmin, acceptAnswerAdmin, getAdminMentors, createMentorAdmin, updateMentorAdmin, deactivateMentorAdmin } from '../../controller/community/admin.community.controller.js';
import {
  listMentorGroupsAdmin,
  createMentorGroupAdmin,
  getMentorGroupAdmin,
  updateMentorGroupAdmin,
  archiveMentorGroupAdmin,
  listMentorOwnerOptions,
  listMentorGroupCommunities,
  searchMentorGroupUsers,
  getMentorGroupMembersAdmin,
  addMentorGroupMembersAdmin,
  removeMentorGroupMemberAdmin,
  detachMentorGroupCommunityAdmin,
} from '../../controller/community/admin.mentorGroups.controller.js';
import { runScheduledCleanup } from '../../controller/community/communityCleanup.controller.js';

const router = express.Router();

// Admin routes
router.get('/all', adminAuth, requirePermission('manage_community'), getAllPosts);
router.delete('/posts/:postId/admin', adminAuth, requirePermission('manage_community'), requirePostScope, validateMongoIdParams('postId'), deletePostAdmin);
router.patch('/posts/:postId/pin', adminAuth, requirePermission('manage_community'), requirePostScope, validateMongoIdParams('postId'), togglePinPost);
router.patch('/posts/:postId/block', adminAuth, requirePermission('manage_community'), requirePostScope, validateMongoIdParams('postId'), toggleBlockPost);
router.post('/admin/users/:userId/posting-block', adminAuth, requirePermission('manage_community'), validateMongoIdParams('userId'), setUserPostingBlock);
router.post('/admin/posts', adminAuth, requirePermission('manage_community'), communityPostLimiter, sanitizePostContent, validateCreatePost, createPostAdmin);
router.get('/admin/groups', adminAuth, requirePermission('manage_community'), getAdminGroups);
router.get('/admin/groups/general', adminAuth, requirePermission('manage_community'), getGeneralGroup);
router.patch('/admin/groups/general', adminAuth, requirePermission('manage_community'), updateGeneralGroup);
router.get('/admin/posts/:postId/comments', adminAuth, requirePermission('manage_community'), requirePostScope, validateMongoIdParams('postId'), getPostCommentsAdmin);
router.patch('/admin/posts/:postId/resolve', adminAuth, requirePermission('manage_community'), requirePostScope, validateMongoIdParams('postId'), resolveQuestionAdmin);
router.patch('/admin/posts/:postId/accept-answer', adminAuth, requirePermission('manage_community'), requirePostScope, validateMongoIdParams('postId'), acceptAnswerAdmin);
router.get('/admin/mentors', adminAuth, requirePermission('manage_community'), getAdminMentors);
router.post('/admin/mentors', adminAuth, requirePermission('manage_community'), createMentorAdmin);
router.patch('/admin/mentors/:mentorId', adminAuth, requirePermission('manage_community'), validateMongoIdParams('mentorId'), updateMentorAdmin);
router.delete('/admin/mentors/:mentorId', adminAuth, requirePermission('manage_community'), validateMongoIdParams('mentorId'), deactivateMentorAdmin);

// Mentor Groups (admin management)
router.get('/admin/mentor-groups', adminAuth, requirePermission('manage_mentor_groups'), listMentorGroupsAdmin);
router.post('/admin/mentor-groups', adminAuth, requirePermission('manage_mentor_groups'), requireAllPermissionScope('manage_mentor_groups'), createMentorGroupAdmin);
router.get('/admin/mentor-groups/mentors', adminAuth, requirePermission('manage_mentor_groups'), listMentorOwnerOptions);
router.get('/admin/mentor-groups/communities', adminAuth, requirePermission('manage_mentor_groups'), listMentorGroupCommunities);
router.get('/admin/mentor-groups/user-candidates', adminAuth, requirePermission('manage_mentor_groups'), searchMentorGroupUsers);
router.get('/admin/mentor-groups/:groupId', adminAuth, requirePermission('manage_mentor_groups'), validateMongoIdParams('groupId'), requireResourceScope('manage_mentor_groups', 'groupId'), getMentorGroupAdmin);
router.patch('/admin/mentor-groups/:groupId', adminAuth, requirePermission('manage_mentor_groups'), validateMongoIdParams('groupId'), requireResourceScope('manage_mentor_groups', 'groupId'), updateMentorGroupAdmin);
router.delete('/admin/mentor-groups/:groupId', adminAuth, requirePermission('manage_mentor_groups'), validateMongoIdParams('groupId'), requireResourceScope('manage_mentor_groups', 'groupId'), archiveMentorGroupAdmin);
router.get('/admin/mentor-groups/:groupId/members', adminAuth, requirePermission('manage_mentor_groups'), validateMongoIdParams('groupId'), requireResourceScope('manage_mentor_groups', 'groupId'), getMentorGroupMembersAdmin);
router.post('/admin/mentor-groups/:groupId/members', adminAuth, requirePermission('manage_mentor_groups'), validateMongoIdParams('groupId'), requireResourceScope('manage_mentor_groups', 'groupId'), addMentorGroupMembersAdmin);
router.delete('/admin/mentor-groups/:groupId/members/:userId', adminAuth, requirePermission('manage_mentor_groups'), validateMongoIdParams('groupId'), validateMongoIdParams('userId'), requireResourceScope('manage_mentor_groups', 'groupId'), removeMentorGroupMemberAdmin);
router.delete('/admin/mentor-groups/:groupId/linked-groups/:communityId', adminAuth, requirePermission('manage_mentor_groups'), validateMongoIdParams('groupId'), validateMongoIdParams('communityId'), requireResourceScope('manage_mentor_groups', 'groupId'), detachMentorGroupCommunityAdmin);
router.delete('/comments/:commentId/admin', adminAuth, requirePermission('manage_community'), requireCommentScope, validateMongoIdParams('commentId'), deleteCommentAdmin);
router.get('/admin/cleanup-expired', adminAuth, requirePermission('manage_community'), runScheduledCleanup);  // Scheduled cleanup endpoint

// All other community routes require authentication
router.use(protectedRoutes);

// ========================================
// Community Access
// ========================================
router.get('/check-access', checkCommunityAccess);

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
router.post('/groups', communityPostLimiter, createMentorGroup);
router.get('/groups/:groupId/members', validateMongoIdParams('groupId'), getMentorGroupMembers);
router.post('/groups/:groupId/members', validateMongoIdParams('groupId'), addMentorGroupMembers);
router.get('/groups/:groupId/member-candidates', validateMongoIdParams('groupId'), getMentorGroupCandidates);
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
