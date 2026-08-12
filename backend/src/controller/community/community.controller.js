import { Group, GroupMember, Post, Comment } from '../../models/community.models.js';
import { evaluateCommunityAccess } from '../../services/entitlement.service.js';
import { syncUserCommunityMembershipsByPlan } from '../../services/planUpgrade.service.js';
import { UserMembership } from '../../models/userMembership.models.js';

const normalizeCategory = (value) => String(value || '').trim().toLowerCase();

/**
 * Check if user has community access (free users get General group, paid users get plan groups)
 * GET /api/community/check-access
 */
export const checkCommunityAccess = async (req, res) => {
  try {
    const userId = req.user._id;

    const access = await evaluateCommunityAccess(userId);
    if (access.reason === 'user_not_found') {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      hasAccess: access.hasAccess,
      subscriptionPlan: access.plan,
      subscriptionStatus: access.status,
      reason: access.reason,
      isFreeUser: access.isFreeUser || false,
    });

  } catch (error) {
    console.error("❌ Error checking community access:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const ensureGeneralGroup = async () => {
  const generalGroup = await Group.findOneAndUpdate(
    { groupType: 'plan', planSlug: 'general' },
    {
      $setOnInsert: {
        name: 'General Community',
        description: 'A public space for all users. Join the conversation!',
        groupType: 'plan',
        planSlug: 'general',
        isActive: true,
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return generalGroup;
};

const enrollUserInGroup = async (groupId, userId) => {
  // Atomic upsert — prevents race conditions on concurrent enrollment
  const result = await GroupMember.findOneAndUpdate(
    { groupId, userId },
    { $setOnInsert: { groupId, userId, role: 'member', isActive: true }, $set: { isActive: true } },
    { upsert: true, new: true, rawResult: true }
  );

  // Only increment memberCount if this was a new insert (not an existing membership)
  if (!result.lastErrorObject?.updatedExisting) {
    await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } });
    console.log(`👤 Enrolled user ${userId} in group ${groupId}`);
  }

  return result.value;
};

const formatPlanLabel = (planSlug) => {
  const normalized = String(planSlug || '').trim().toLowerCase();
  if (!normalized) return 'Plan';
  return normalized
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatCategoryLabel = (category) => {
  const normalized = normalizeCategory(category);
  const labels = { physical: 'Physical', mental: 'Mental', financial: 'Financial', relationship: 'Relationship', spiritual: 'Spiritual', general: 'General' };
  return labels[normalized] || (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'General');
};

/**
 * Get user's groups - returns hierarchical plan -> subgroup tree for paid users,
 * or General group for free users.
 * GET /api/community/my-groups
 */
export const getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const access = await evaluateCommunityAccess(userId);
    if (!access.hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Community access requires an active membership"
      });
    }

    const isFreeUser = access.isFreeUser === true;

    if (isFreeUser) {
      const generalGroup = await ensureGeneralGroup();
      await enrollUserInGroup(generalGroup._id, userId);
      const reFetched = await Group.findById(generalGroup._id).select('memberCount').lean();
      const membership = await GroupMember.findOne({ groupId: generalGroup._id, userId, isActive: true }).lean();

      const formatted = {
        _id: generalGroup._id,
        name: generalGroup.name,
        description: generalGroup.description,
        memberCount: reFetched?.memberCount || 0,
        coverImage: generalGroup.coverImage || null,
        groupType: 'plan',
        planSlug: 'general',
        category: null,
        parentGroupId: null,
        course: null,
        joinedAt: membership?.joinedAt || new Date(),
        role: membership?.role || 'member',
      };

      return res.status(200).json({
        success: true,
        planGroups: [{ ...formatted, subgroups: [] }],
        groups: [formatted],
        otherGroups: [],
        totalGroups: 1,
      });
    }

    const activeMemberships = await UserMembership.find({
      userId,
      status: 'active',
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null },
        { endDate: { $exists: false } },
      ],
    })
      .populate('planId')
      .sort({ endDate: -1 })
      .lean();

    if (!activeMemberships.length) {
      const generalGroup = await ensureGeneralGroup();
      await enrollUserInGroup(generalGroup._id, userId);
      const fmt = {
        _id: generalGroup._id, name: generalGroup.name, description: generalGroup.description,
        memberCount: generalGroup.memberCount || 0, coverImage: generalGroup.coverImage || null,
        groupType: 'plan', planSlug: 'general', category: null, parentGroupId: null,
        course: null, joinedAt: new Date(), role: 'member',
      };
      return res.status(200).json({
        success: true,
        planGroups: [{ ...fmt, subgroups: [] }],
        groups: [fmt],
        otherGroups: [],
        totalGroups: 1,
      });
    }

    const allPlanGroups = [];

    for (const membership of activeMemberships) {
      const planSlug = membership?.planId?.slug || access.planSlug;
      if (!planSlug || planSlug === 'free') continue;

      const existingPlanMembership = await GroupMember.findOne({
        userId,
        isActive: true,
        groupId: { $in: await Group.find({ groupType: 'plan', planSlug, isActive: true }).select('_id').lean().then(g => g.map(x => x._id)) }
      });

      if (!existingPlanMembership) {
        await syncUserCommunityMembershipsByPlan({
          userId,
          planSlug,
          membershipActive: true,
        });
      }

      const planParentGroup = await Group.findOne({ groupType: 'plan', planSlug, isActive: true }).lean();
      const categorySubgroups = await Group.find({
        groupType: 'category',
        planSlug,
        isActive: true,
      }).sort({ name: 1 }).lean();

      if (planParentGroup || categorySubgroups.length > 0) {
        const userMemberships = await GroupMember.find({
          userId,
          isActive: true,
          groupId: { $in: [planParentGroup?._id, ...categorySubgroups.map((g) => g._id)].filter(Boolean) },
        }).select('groupId joinedAt role').lean();

        const membershipByGroupId = new Map(userMemberships.map((m) => [String(m.groupId), m]));

        const formatGroupLocal = (group) => {
          const mem = membershipByGroupId.get(String(group._id));
          return {
            _id: group._id,
            name: group.name,
            description: group.description,
            memberCount: group.memberCount || 0,
            coverImage: group.coverImage || null,
            groupType: group.groupType,
            planSlug: group.planSlug,
            category: group.category || null,
            parentGroupId: group.parentGroupId || null,
            course: group.courseId || null,
            joinedAt: mem?.joinedAt || new Date(),
            role: mem?.role || 'member',
          };
        };

        allPlanGroups.push({
          ...formatGroupLocal(planParentGroup || {
            _id: null,
            name: `${formatPlanLabel(planSlug)} Community`,
            description: `Community for ${formatPlanLabel(planSlug)} plan members`,
            memberCount: 0,
            groupType: 'plan',
            planSlug,
            category: null,
            parentGroupId: null,
          }),
          subgroups: categorySubgroups.map(formatGroupLocal),
        });
      }
    }

    const allGroups = allPlanGroups.flatMap(pg => [pg, ...pg.subgroups]).filter(g => g._id);

    return res.status(200).json({
      success: true,
      planGroups: allPlanGroups,
      groups: allGroups,
      otherGroups: [],
      totalGroups: allPlanGroups.length + allPlanGroups.reduce((sum, pg) => sum + (pg.subgroups?.length || 0), 0),
    });

  } catch (error) {
    console.error("❌ Error fetching user groups:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get posts from a specific group (or combined feed for plan-level groups)
 * GET /api/community/groups/:groupId/posts
 */
export const getGroupPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Double-check: User must have active community access
    const access = await evaluateCommunityAccess(userId);
    if (!access.hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Community access requires an active membership"
      });
    }

    // Determine which group IDs to query posts from
    // If this is a plan-level parent group, get posts from all child subgroups too
    const group = await Group.findById(groupId).select('groupType').lean();
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    // Check if user is a member of this group
    const membership = await GroupMember.findOne({ groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    let queryGroupIds = [groupId];

    if (group.groupType === 'plan') {
      const childGroups = await Group.find({ parentGroupId: groupId, isActive: true })
        .select('_id')
        .lean();
      const childIds = childGroups.map((g) => g._id);
      queryGroupIds = [groupId, ...childIds];
    }

    // Build post query - use $in for combined feeds
    const postQuery = { groupId: { $in: queryGroupIds }, isActive: true };

    // Get posts
    const posts = await Post.find(postQuery)
      .populate('userId', 'displayName photoURL subscriptionPlan')
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments(postQuery);

    // Check if current user liked each post
    const postsWithUserLike = posts.map(post => {
      const userLiked = post.likes.some(like => like.userId.toString() === userId.toString());
      return {
        _id: post._id,
        content: post.content,
        images: post.images,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        isPinned: post.isPinned,
        userLiked,
        author: post.userId ? {
          _id: post.userId._id,
          displayName: post.userId.displayName,
          photoURL: post.userId.photoURL,
          subscriptionPlan: post.userId.subscriptionPlan
        } : {
          _id: null,
          displayName: post.authorName || 'ParamSukh Admin',
          photoURL: null,
          subscriptionPlan: 'admin'
        },
        tags: post.tags,
        groupId: post.groupId, // Include so client knows which subgroup the post belongs to
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      };
    });

    return res.status(200).json({
      success: true,
      posts: postsWithUserLike,
      isCombinedFeed: queryGroupIds.length > 1,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasMore: skip + posts.length < totalPosts
      }
    });

  } catch (error) {
    console.error("❌ Error fetching group posts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Create a new post in a group
 * POST /api/community/groups/:groupId/posts
 */
export const createPost = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.params;
    const { content, images, tags } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Post content is required"
      });
    }

    // Check if user is a member of this group
    const membership = await GroupMember.findOne({ groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    const post = await Post.create({
      userId,
      groupId,
      content: content.trim(),
      images: images || [],
      tags: tags || []
    });

    const populatedPost = await Post.findById(post._id)
      .populate('userId', 'displayName photoURL subscriptionPlan');

    console.log(`✅ Post created in group ${groupId} by user ${userId}`);

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: {
        _id: populatedPost._id,
        content: populatedPost.content,
        images: populatedPost.images,
        likeCount: populatedPost.likeCount,
        commentCount: populatedPost.commentCount,
        author: {
          _id: populatedPost.userId._id,
          displayName: populatedPost.userId.displayName,
          photoURL: populatedPost.userId.photoURL,
          subscriptionPlan: populatedPost.userId.subscriptionPlan
        },
        tags: populatedPost.tags,
        createdAt: populatedPost.createdAt
      }
    });

  } catch (error) {
    console.error("❌ Error creating post:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Like/Unlike a post
 * POST /api/community/posts/:postId/like
 */
export const togglePostLike = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Check if user is a member of the group
    const membership = await GroupMember.findOne({ groupId: post.groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    // Atomic toggle — prevents race conditions on concurrent likes
    const alreadyLiked = post.likes.some(like => like.userId.toString() === userId.toString());

    if (alreadyLiked) {
      await Post.findOneAndUpdate(
        { _id: postId, 'likes.userId': userId },
        { $pull: { likes: { userId } }, $inc: { likeCount: -1 } }
      );
    } else {
      await Post.findOneAndUpdate(
        { _id: postId, 'likes.userId': { $ne: userId } },
        { $addToSet: { likes: { userId } }, $inc: { likeCount: 1 } }
      );
    }

    const updated = await Post.findById(postId).select('likeCount').lean();

    return res.status(200).json({
      success: true,
      liked: !alreadyLiked,
      likeCount: updated?.likeCount ?? post.likeCount
    });

  } catch (error) {
    console.error("❌ Error toggling post like:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get comments for a post
 * GET /api/community/posts/:postId/comments
 */
export const getPostComments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Check if user is a member of the group
    const membership = await GroupMember.findOne({ groupId: post.groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    const [comments, total] = await Promise.all([
      Comment.find({ postId, isActive: true })
        .populate('userId', 'displayName photoURL subscriptionPlan')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Comment.countDocuments({ postId, isActive: true })
    ]);

    const commentsWithUserLike = comments.map(comment => {
      const userLiked = comment.likes.some(like => like.userId.toString() === userId.toString());
      return {
        _id: comment._id,
        postId: comment.postId,
        parentCommentId: comment.parentCommentId || null,
        content: comment.content,
        likeCount: comment.likeCount,
        replyCount: comment.replyCount || 0,
        userLiked,
        author: {
          _id: comment.userId._id,
          displayName: comment.userId.displayName,
          photoURL: comment.userId.photoURL,
          subscriptionPlan: comment.userId.subscriptionPlan
        },
        createdAt: comment.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      comments: commentsWithUserLike,
      totalComments: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error("❌ Error fetching comments:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Add a comment to a post
 * POST /api/community/posts/:postId/comments
 */
export const addComment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;
    const { content, parentCommentId } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required"
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Check if user is a member of the group
    const membership = await GroupMember.findOne({ groupId: post.groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    let parentComment = null;
    if (parentCommentId) {
      parentComment = await Comment.findOne({ _id: parentCommentId, postId, isActive: true })
        .populate('userId', 'displayName photoURL subscriptionPlan');
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: "The comment you want to reply to was not found"
        });
      }
    }

    const comment = await Comment.create({
      postId,
      userId,
      parentCommentId: parentComment ? parentComment._id : null,
      content: content.trim()
    });

    // Atomic increment — prevents lost updates on concurrent comments
    await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

    if (parentComment) {
      await Comment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });
    }

    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'displayName photoURL subscriptionPlan');

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: {
        _id: populatedComment._id,
        postId: populatedComment.postId,
        parentCommentId: populatedComment.parentCommentId || null,
        content: populatedComment.content,
        likeCount: populatedComment.likeCount,
        replyCount: populatedComment.replyCount || 0,
        author: {
          _id: populatedComment.userId._id,
          displayName: populatedComment.userId.displayName,
          photoURL: populatedComment.userId.photoURL,
          subscriptionPlan: populatedComment.userId.subscriptionPlan
        },
        parentComment: parentComment ? {
          _id: parentComment._id,
          content: parentComment.content,
          author: {
            _id: parentComment.userId?._id,
            displayName: parentComment.userId?.displayName,
            photoURL: parentComment.userId?.photoURL,
            subscriptionPlan: parentComment.userId?.subscriptionPlan
          }
        } : null,
        createdAt: populatedComment.createdAt
      }
    });

  } catch (error) {
    console.error("❌ Error adding comment:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Like/Unlike a comment
 * POST /api/community/comments/:commentId/like
 */
export const toggleCommentLike = async (req, res) => {
  try {
    const userId = req.user._id;
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    const alreadyLiked = comment.likes.some(like => like.userId.toString() === userId.toString());

    if (alreadyLiked) {
      await Comment.findOneAndUpdate(
        { _id: commentId, 'likes.userId': userId },
        { $pull: { likes: { userId } }, $inc: { likeCount: -1 } }
      );
    } else {
      await Comment.findOneAndUpdate(
        { _id: commentId, 'likes.userId': { $ne: userId } },
        { $addToSet: { likes: { userId } }, $inc: { likeCount: 1 } }
      );
    }

    const updated = await Comment.findById(commentId).select('likeCount').lean();

    return res.status(200).json({
      success: true,
      liked: !alreadyLiked,
      likeCount: updated?.likeCount ?? comment.likeCount
    });

  } catch (error) {
    console.error("❌ Error toggling comment like:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Delete a post (only by post author)
 * DELETE /api/community/posts/:postId
 */
export const deletePost = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // User must still be an active group member
    const membership = await GroupMember.findOne({ groupId: post.groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    // Only post author can delete
    if (post.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own posts"
      });
    }

    // Soft delete
    post.isActive = false;
    await post.save();

    // Also soft delete all comments
    await Comment.updateMany({ postId }, { isActive: false });

    console.log(`🗑️ Post ${postId} deleted by user ${userId}`);

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting post:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
