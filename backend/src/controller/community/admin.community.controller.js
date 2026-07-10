import { Post, Comment, Group } from '../../models/community.models.js';

// @desc    Get all community posts (Admin only)
// @route   GET /api/community/all
// @access  Admin
export const getAllPosts = async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;

        const query = { isActive: true }; // Only show active posts

        if (search) {
            query.content = { $regex: search, $options: 'i' };
        }

        const posts = await Post.find(query)
            .populate('userId', 'displayName email photoURL')
            .populate('groupId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
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

// @desc    Create a community post (Admin only)
// @route   POST /api/community/admin/posts
// @access  Admin
export const createPostAdmin = async (req, res) => {
    try {
        const { content, groupId, images, tags } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Post content is required'
            });
        }

        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: 'Group ID is required'
            });
        }

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const post = await Post.create({
            userId: req.admin._id,
            groupId,
            content: content.trim(),
            images: images || [],
            tags: tags || []
        });

        const populatedPost = await Post.findById(post._id)
            .populate('userId', 'displayName email photoURL')
            .populate('groupId', 'name');

        console.log(`📝 Admin ${req.admin._id} created post in group ${groupId}`);

        res.status(201).json({
            success: true,
            message: 'Post created successfully',
            data: populatedPost
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
