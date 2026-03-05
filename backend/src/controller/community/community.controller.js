import { User } from '../../models/user.models.js';
import { Group, GroupMember, Post, Comment } from '../../models/community.models.js';
import { Course } from '../../models/course.models.js';

/**
 * Check if user has community access (any paid membership)
 * GET /api/community/check-access
 */
export const checkCommunityAccess = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const hasCommunityAccess = user.subscriptionPlan !== 'free' && user.subscriptionStatus === 'active';

    return res.status(200).json({
      success: true,
      hasAccess: hasCommunityAccess,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus
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

/**
 * Get user's groups (based on enrolled courses)
 * GET /api/community/my-groups
 */
export const getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check community access
    const user = await User.findById(userId);
    if (!user || user.subscriptionPlan === 'free' || user.subscriptionStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: "Community access requires an active membership"
      });
    }

    // Get user's group memberships
    const memberships = await GroupMember.find({ userId, isActive: true })
      .populate({
        path: 'groupId',
        populate: {
          path: 'courseId',
          select: 'title category thumbnail'
        }
      })
      .sort({ joinedAt: -1 });

    const groups = memberships.map(m => ({
      _id: m.groupId._id,
      name: m.groupId.name,
      description: m.groupId.description,
      memberCount: m.groupId.memberCount,
      coverImage: m.groupId.coverImage,
      course: m.groupId.courseId,
      joinedAt: m.joinedAt,
      role: m.role
    }));

    return res.status(200).json({
      success: true,
      groups,
      totalGroups: groups.length
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
 * Get posts from a specific group
 * GET /api/community/groups/:groupId/posts
 */
export const getGroupPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Check if user is a member of this group
    const membership = await GroupMember.findOne({ groupId, userId, isActive: true });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    // Get posts
    const posts = await Post.find({ groupId, isActive: true })
      .populate('userId', 'displayName photoURL subscriptionPlan')
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments({ groupId, isActive: true });

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
        author: {
          _id: post.userId._id,
          displayName: post.userId.displayName,
          photoURL: post.userId.photoURL,
          subscriptionPlan: post.userId.subscriptionPlan
        },
        tags: post.tags,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      };
    });

    return res.status(200).json({
      success: true,
      posts: postsWithUserLike,
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

    const likeIndex = post.likes.findIndex(like => like.userId.toString() === userId.toString());

    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
      post.likeCount = Math.max(0, post.likeCount - 1);
    } else {
      // Like
      post.likes.push({ userId });
      post.likeCount += 1;
    }

    await post.save();

    return res.status(200).json({
      success: true,
      liked: likeIndex === -1,
      likeCount: post.likeCount
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

    const comments = await Comment.find({ postId, isActive: true })
      .populate('userId', 'displayName photoURL subscriptionPlan')
      .sort({ createdAt: -1 });

    const commentsWithUserLike = comments.map(comment => {
      const userLiked = comment.likes.some(like => like.userId.toString() === userId.toString());
      return {
        _id: comment._id,
        content: comment.content,
        likeCount: comment.likeCount,
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
      totalComments: comments.length
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
    const { content } = req.body;

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

    const comment = await Comment.create({
      postId,
      userId,
      content: content.trim()
    });

    // Update post comment count
    post.commentCount += 1;
    await post.save();

    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'displayName photoURL subscriptionPlan');

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: {
        _id: populatedComment._id,
        content: populatedComment.content,
        likeCount: populatedComment.likeCount,
        author: {
          _id: populatedComment.userId._id,
          displayName: populatedComment.userId.displayName,
          photoURL: populatedComment.userId.photoURL,
          subscriptionPlan: populatedComment.userId.subscriptionPlan
        },
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

    const likeIndex = comment.likes.findIndex(like => like.userId.toString() === userId.toString());

    if (likeIndex > -1) {
      // Unlike
      comment.likes.splice(likeIndex, 1);
      comment.likeCount = Math.max(0, comment.likeCount - 1);
    } else {
      // Like
      comment.likes.push({ userId });
      comment.likeCount += 1;
    }

    await comment.save();

    return res.status(200).json({
      success: true,
      liked: likeIndex === -1,
      likeCount: comment.likeCount
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
