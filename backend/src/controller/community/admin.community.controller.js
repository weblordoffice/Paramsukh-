import { Post, Comment, Group } from '../../models/community.models.js';

// @desc    Get all community posts (Admin only)
// @route   GET /api/community/all
// @access  Admin
export const getAllPosts = async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

        const query = { isActive: true };

        if (search) {
            // Escape regex-special characters to prevent ReDoS attacks
            const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.content = { $regex: escaped, $options: 'i' };
        }

        const posts = await Post.find(query)
            .populate('userId', 'displayName email photoURL')
            .populate('groupId', 'name')
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .lean();

        const total = await Post.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                posts,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total
                }
            }
        });
    } catch (error) {
        console.error('Get All Posts Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve posts',
            error: error.message
        });
    }
};

// @desc    Delete a post (Admin only)
// @route   DELETE /api/community/posts/:postId
// @access  Admin
export const deletePostAdmin = async (req, res) => {
    try {
        const { postId } = req.params;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        // Soft delete
        post.isActive = false;
        await post.save();

        // Also soft delete all comments
        await Comment.updateMany({ postId }, { isActive: false });

        console.log(`🗑️ Admin deleted post ${postId}`);

        res.status(200).json({
            success: true,
            message: 'Post deleted successfully'
        });
    } catch (error) {
        console.error('Delete Post Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete post',
            error: error.message
        });
    }
};

// @desc    Pin/Unpin a post (Admin only)
// @route   PATCH /api/community/posts/:postId/pin
// @access  Admin
export const togglePinPost = async (req, res) => {
    try {
        const { postId } = req.params;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        post.isPinned = !post.isPinned;
        await post.save();

        console.log(`📌 Admin ${post.isPinned ? 'pinned' : 'unpinned'} post ${postId}`);

        res.status(200).json({
            success: true,
            message: `Post ${post.isPinned ? 'pinned' : 'unpinned'} successfully`,
            data: { isPinned: post.isPinned }
        });
    } catch (error) {
        console.error('Toggle Pin Post Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle pin status',
            error: error.message
        });
    }
};

// @desc    Create a community post in one or more groups (Admin only)
// @route   POST /api/community/admin/posts
// @access  Admin
export const createPostAdmin = async (req, res) => {
    try {
        const { content, groupId, groupIds, images, tags } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Post content is required'
            });
        }

        // Support single groupId (legacy) or multiple groupIds (new)
        const targetGroupIds = Array.isArray(groupIds) && groupIds.length > 0
            ? groupIds.filter(Boolean)
            : (groupId ? [groupId] : []);

        if (targetGroupIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one group ID is required'
            });
        }

        const groups = await Group.find({ _id: { $in: targetGroupIds }, isActive: true }).select('_id').lean();
        const validGroupIds = groups.map((g) => String(g._id));

        if (validGroupIds.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No valid active groups found'
            });
        }

        const createdPosts = [];
        for (const gid of validGroupIds) {
            const post = await Post.create({
                userId: req.admin?._id || null,
                isAdminPost: true,
                authorName: req.admin?.name || req.admin?.email || 'ParamSukh Admin',
                groupId: gid,
                content: content.trim(),
                images: images || [],
                tags: tags || []
            });
            createdPosts.push(post);
        }

        const populatedPosts = await Post.find({ _id: { $in: createdPosts.map((p) => p._id) } })
            .populate('userId', 'displayName email photoURL')
            .populate('groupId', 'name');

        console.log(`📝 Admin created post in ${validGroupIds.length} group(s)`);

        res.status(201).json({
            success: true,
            message: `Post created in ${validGroupIds.length} group(s)`,
            data: populatedPosts
        });
    } catch (error) {
        console.error('Admin Create Post Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create post',
            error: error.message
        });
    }
};

// @desc    Get all groups (Admin only)
// @route   GET /api/community/admin/groups
// @access  Admin
export const getAdminGroups = async (req, res) => {
    try {
        const groups = await Group.find({ isActive: true })
            .select('name groupType description memberCount')
            .sort({ name: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: groups
        });
    } catch (error) {
        console.error('Get Admin Groups Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve groups',
            error: error.message
        });
    }
};

// @desc    Get all comments for a post (Admin only)
// @route   GET /api/community/admin/posts/:postId/comments
// @access  Admin
export const getPostCommentsAdmin = async (req, res) => {
    try {
        const { postId } = req.params;

        const comments = await Comment.find({ postId, isActive: true })
            .populate('userId', 'displayName email photoURL')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: comments
        });
    } catch (error) {
        console.error('Get Post Comments Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve comments',
            error: error.message
        });
    }
};

// @desc    Delete a comment (Admin only)
// @route   DELETE /api/community/comments/:commentId/admin
// @access  Admin
export const deleteCommentAdmin = async (req, res) => {
    try {
        const { commentId } = req.params;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Soft delete
        comment.isActive = false;
        await comment.save();

        // Decrement post commentCount
        await Post.findByIdAndUpdate(comment.postId, { $inc: { commentCount: -1 } });

        // If it's a reply, decrement parent comment's replyCount
        if (comment.parentCommentId) {
            await Comment.findByIdAndUpdate(comment.parentCommentId, { $inc: { replyCount: -1 } });
        }

        console.log(`🗑️ Admin deleted comment ${commentId}`);

        res.status(200).json({
            success: true,
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        console.error('Delete Comment Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete comment',
            error: error.message
        });
    }
};
