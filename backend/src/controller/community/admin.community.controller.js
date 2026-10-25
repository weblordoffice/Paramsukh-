import mongoose from 'mongoose';
import { Post, Comment, Group, MentorProfile } from '../../models/community.models.js';
import { User } from '../../models/user.models.js';
import Notification from '../../models/notification.models.js';
import { sendPushToUser } from '../../services/pushService.js';
import { ensureGeneralGroup, assignMentorToGroup, removeMentorFromGroup } from '../../services/community.service.js';
import {
    awardCommunityPoints,
    revokeCommunityPointsForRef,
    revokeCommunityPointsForPost,
} from '../../services/communityPoints.service.js';

// @desc    Get all community posts (Admin only)
// @route   GET /api/community/all
// @access  Admin
export const getAllPosts = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, postType, status, groupId } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

        const query = { isActive: true };

        if (postType === 'question') {
            query.postType = 'question';
        } else if (postType === 'discussion') {
            query.$and = [
                { $or: [{ postType: 'discussion' }, { postType: { $exists: false } }, { postType: null }] },
            ];
        }

        if (status === 'unanswered') query.isResolved = false;
        if (status === 'resolved') query.isResolved = true;

        if (groupId) query.groupId = groupId;

        if (search) {
            // Escape regex-special characters to prevent ReDoS attacks
            const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { content: { $regex: escaped, $options: 'i' } },
                { title: { $regex: escaped, $options: 'i' } },
            ];
        }

        const posts = await Post.find(query)
            .populate('userId', 'displayName email photoURL communityPostingBlocked')
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

        const commentIds = await Comment.find({ postId }).distinct('_id');
        await revokeCommunityPointsForPost(post._id, commentIds);

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

// @desc    Block / unblock a post (hide from members) (Admin only)
// @route   PATCH /api/community/posts/:postId/block
// @access  Admin
export const toggleBlockPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { blocked } = req.body;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        post.isBlocked = typeof blocked === 'boolean' ? blocked : !post.isBlocked;
        await post.save();

        console.log(`🚫 Admin ${post.isBlocked ? 'blocked' : 'unblocked'} post ${postId}`);

        res.status(200).json({
            success: true,
            message: `Post ${post.isBlocked ? 'blocked' : 'unblocked'} successfully`,
            data: { isBlocked: post.isBlocked }
        });
    } catch (error) {
        console.error('Toggle Block Post Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update block status',
            error: error.message
        });
    }
};

// @desc    Block / unblock a user from creating community posts (Admin only)
// @route   POST /api/community/admin/users/:userId/posting-block
// @access  Admin
export const setUserPostingBlock = async (req, res) => {
    try {
        const { userId } = req.params;
        const { blocked } = req.body;

        const user = await User.findById(userId).select('displayName email communityPostingBlocked');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.communityPostingBlocked = typeof blocked === 'boolean' ? blocked : !user.communityPostingBlocked;
        await user.save();

        console.log(`🚫 Admin ${user.communityPostingBlocked ? 'blocked' : 'unblocked'} posting for user ${userId}`);

        res.status(200).json({
            success: true,
            message: user.communityPostingBlocked
                ? 'User blocked from posting'
                : 'User can post again',
            data: {
                userId: user._id,
                displayName: user.displayName,
                email: user.email,
                communityPostingBlocked: user.communityPostingBlocked
            }
        });
    } catch (error) {
        console.error('Set User Posting Block Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user posting permission',
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
            .select('name groupType description memberCount isPublic ownerId linkedGroupIds')
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

        const [post, comments] = await Promise.all([
            Post.findById(postId).select('acceptedCommentId postType isResolved').lean(),
            Comment.find({ postId, isActive: true })
                .populate('userId', 'displayName email photoURL')
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        const acceptedId = post?.acceptedCommentId ? String(post.acceptedCommentId) : null;

        res.status(200).json({
            success: true,
            data: comments.map((comment) => ({
                ...comment,
                isAccepted: acceptedId === String(comment._id),
            }))
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

        await revokeCommunityPointsForRef({ refType: 'comment', refId: comment._id });

        const post = await Post.findById(comment.postId).select('acceptedCommentId');
        if (post?.acceptedCommentId?.toString() === comment._id.toString()) {
            await Post.findByIdAndUpdate(comment.postId, {
                $set: { acceptedCommentId: null, isResolved: false },
            });
            await revokeCommunityPointsForRef({
                refType: 'post',
                refId: comment.postId,
                action: 'answer_accepted',
            });
        }

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

// @desc    Resolve / unresolve a question (Admin only)
// @route   PATCH /api/community/admin/posts/:postId/resolve
// @access  Admin
export const resolveQuestionAdmin = async (req, res) => {
    try {
        const { postId } = req.params;
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        if ((post.postType || 'discussion') !== 'question') {
            return res.status(400).json({ success: false, message: 'Only questions can be resolved' });
        }

        post.isResolved = typeof req.body?.resolved === 'boolean' ? req.body.resolved : !post.isResolved;
        await post.save();

        res.status(200).json({
            success: true,
            data: { isResolved: post.isResolved, acceptedCommentId: post.acceptedCommentId || null }
        });
    } catch (error) {
        console.error('Resolve Question Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update question status',
            error: error.message
        });
    }
};

// @desc    Accept an answer on a question (Admin only)
// @route   PATCH /api/community/admin/posts/:postId/accept-answer
// @access  Admin
export const acceptAnswerAdmin = async (req, res) => {
    try {
        const { postId } = req.params;
        const { commentId } = req.body;

        if (!commentId) {
            return res.status(400).json({ success: false, message: 'Answer id is required' });
        }

        if (!mongoose.Types.ObjectId.isValid(String(commentId))) {
            return res.status(400).json({ success: false, message: 'Invalid answer id' });
        }

        const [post, comment] = await Promise.all([
            Post.findById(postId),
            Comment.findOne({ _id: commentId, postId, isActive: true }),
        ]);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        if ((post.postType || 'discussion') !== 'question') {
            return res.status(400).json({ success: false, message: 'Only questions can have an accepted answer' });
        }
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Answer not found' });
        }

        await revokeCommunityPointsForRef({
            refType: 'post',
            refId: post._id,
            action: 'answer_accepted',
        });

        post.acceptedCommentId = comment._id;
        post.isResolved = true;
        await post.save();

        await awardCommunityPoints({
            userId: comment.userId,
            action: 'answer_accepted',
            refType: 'post',
            refId: post._id,
            groupId: post.groupId,
            dedupeKey: `accept:${post._id}:${comment._id}`,
            metadata: { commentId: comment._id },
        });

        res.status(200).json({
            success: true,
            data: { acceptedCommentId: post.acceptedCommentId, isResolved: post.isResolved }
        });
    } catch (error) {
        console.error('Accept Answer Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to accept answer',
            error: error.message
        });
    }
};

const normalizeStringArray = (value) => {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
};

const resolveMentorGroupIds = async (groupIds) => {
    const uniqueIds = [...new Set(
        (Array.isArray(groupIds) ? groupIds : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
    )];

    if (uniqueIds.length === 0) return [];

    const groups = await Group.find({ _id: { $in: uniqueIds }, isActive: true })
        .select('_id groupType')
        .lean();

    const planParentIds = groups
        .filter((group) => group.groupType === 'plan')
        .map((group) => group._id);

    const children = planParentIds.length > 0
        ? await Group.find({
            parentGroupId: { $in: planParentIds },
            isActive: true,
        }).select('_id').lean()
        : [];

    return [...new Set([
        ...groups.map((group) => String(group._id)),
        ...children.map((child) => String(child._id)),
    ])];
};

const populateMentor = (mentorId) => MentorProfile.findById(mentorId)
    .populate('userId', 'displayName email phone photoURL subscriptionPlan')
    .populate('groupIds', 'name groupType category planSlug isActive')
    .lean();

const notifyMentorAssigned = async (userId, groupCount = 0) => {
    if (!userId) return;
    try {
        const title = 'You are now a community mentor';
        const message = groupCount > 0
            ? `You have been assigned to ${groupCount} community group${groupCount === 1 ? '' : 's'}.`
            : 'Your mentor profile is ready. Ask an administrator to assign you to groups.';

        await Notification.createNotification({
            user: userId,
            type: 'mentor_assigned',
            title,
            message,
            actionUrl: '/(home)/mentor-corner',
            icon: '🎓',
        });

        await sendPushToUser(userId, {
            title,
            body: message,
            data: { type: 'mentor_assigned', actionUrl: '/(home)/mentor-corner' },
        });
    } catch (error) {
        console.error('Mentor assignment notification error:', error?.message);
    }
};

// @desc    List all mentors (Admin only)
// @route   GET /api/community/admin/mentors
// @access  Admin
export const getAdminMentors = async (req, res) => {
    try {
        const mentors = await MentorProfile.find({})
            .populate('userId', 'displayName email phone photoURL subscriptionPlan')
            .populate('groupIds', 'name groupType category planSlug isActive')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ success: true, data: mentors });
    } catch (error) {
        console.error('Get Admin Mentors Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve mentors',
            error: error.message
        });
    }
};

// @desc    Create a mentor profile (Admin only)
// @route   POST /api/community/admin/mentors
// @access  Admin
export const createMentorAdmin = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User id is required' });
        }

        const user = await User.findById(userId).select('displayName email');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const existing = await MentorProfile.findOne({ userId });
        if (existing) {
            return res.status(409).json({ success: false, message: 'This user is already a mentor' });
        }

        const groupIds = await resolveMentorGroupIds(req.body.groupIds);
        const profile = await MentorProfile.create({
            userId,
            headline: String(req.body.headline || '').trim(),
            bio: String(req.body.bio || '').trim(),
            expertise: normalizeStringArray(req.body.expertise),
            languages: normalizeStringArray(req.body.languages),
            groupIds,
            isVerified: req.body.isVerified === undefined ? true : req.body.isVerified === true,
            isActive: req.body.isActive === undefined ? true : req.body.isActive === true,
        });

        if (profile.isActive) {
            for (const groupId of groupIds) {
                await assignMentorToGroup(userId, groupId);
            }
            await notifyMentorAssigned(userId, groupIds.length);
        }

        const populated = await populateMentor(profile._id);

        res.status(201).json({
            success: true,
            message: 'Mentor created successfully',
            data: populated
        });
    } catch (error) {
        console.error('Create Mentor Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create mentor',
            error: error.message
        });
    }
};

// @desc    Update a mentor profile (Admin only)
// @route   PATCH /api/community/admin/mentors/:mentorId
// @access  Admin
export const updateMentorAdmin = async (req, res) => {
    try {
        const { mentorId } = req.params;
        const profile = await MentorProfile.findById(mentorId);
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Mentor not found' });
        }

        const wasActive = profile.isActive !== false;
        const oldGroupIds = (profile.groupIds || []).map(String);
        const nextGroupIds = req.body.groupIds === undefined
            ? oldGroupIds
            : await resolveMentorGroupIds(req.body.groupIds);
        const nextActive = req.body.isActive === undefined
            ? profile.isActive !== false
            : req.body.isActive === true;

        if (req.body.headline !== undefined) {
            profile.headline = String(req.body.headline || '').trim();
        }
        if (req.body.bio !== undefined) {
            profile.bio = String(req.body.bio || '').trim();
        }
        if (req.body.expertise !== undefined) {
            profile.expertise = normalizeStringArray(req.body.expertise);
        }
        if (req.body.languages !== undefined) {
            profile.languages = normalizeStringArray(req.body.languages);
        }
        if (req.body.isVerified !== undefined) {
            profile.isVerified = req.body.isVerified === true;
        }

        if (nextActive) {
            for (const groupId of oldGroupIds) {
                if (!nextGroupIds.includes(groupId)) {
                    await removeMentorFromGroup(profile.userId, groupId);
                }
            }
            for (const groupId of nextGroupIds) {
                await assignMentorToGroup(profile.userId, groupId);
            }
        } else {
            for (const groupId of new Set([...oldGroupIds, ...nextGroupIds])) {
                await removeMentorFromGroup(profile.userId, groupId);
            }
        }

        profile.groupIds = nextGroupIds;
        profile.isActive = nextActive;
        await profile.save();

        if (nextActive && (!wasActive || req.body.groupIds !== undefined)) {
            await notifyMentorAssigned(profile.userId, nextGroupIds.length);
        }

        const populated = await populateMentor(profile._id);

        res.status(200).json({
            success: true,
            message: nextActive ? 'Mentor updated successfully' : 'Mentor deactivated',
            data: populated
        });
    } catch (error) {
        console.error('Update Mentor Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update mentor',
            error: error.message
        });
    }
};

// @desc    Deactivate a mentor (Admin only)
// @route   DELETE /api/community/admin/mentors/:mentorId
// @access  Admin
export const deactivateMentorAdmin = async (req, res) => {
    try {
        const { mentorId } = req.params;
        const profile = await MentorProfile.findById(mentorId);
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Mentor not found' });
        }

        for (const groupId of profile.groupIds || []) {
            await removeMentorFromGroup(profile.userId, groupId);
        }

        profile.isActive = false;
        await profile.save();

        const populated = await populateMentor(profile._id);

        res.status(200).json({
            success: true,
            message: 'Mentor deactivated',
            data: populated
        });
    } catch (error) {
        console.error('Deactivate Mentor Admin Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate mentor',
            error: error.message
        });
    }
};

const formatGeneralGroup = (group) => ({
    _id: group._id,
    name: group.name,
    description: group.description || '',
    coverImage: group.coverImage || null,
    memberCount: group.memberCount || 0,
    isActive: group.isActive !== false,
    isPublic: true,
});

// @desc    Get the General (public) community group
// @route   GET /api/community/admin/groups/general
// @access  Admin
export const getGeneralGroup = async (req, res) => {
    try {
        const group = await ensureGeneralGroup();
        res.status(200).json({ success: true, data: formatGeneralGroup(group) });
    } catch (error) {
        console.error('Get General Group Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve the General group',
            error: error.message,
        });
    }
};

// @desc    Update the General (public) community group
// @route   PATCH /api/community/admin/groups/general
// @access  Admin
export const updateGeneralGroup = async (req, res) => {
    try {
        const { name, description, coverImage, isActive } = req.body;

        const update = {};
        if (name !== undefined) {
            const trimmed = String(name).trim();
            if (!trimmed) {
                return res.status(400).json({ success: false, message: 'Name is required' });
            }
            update.name = trimmed;
        }
        if (description !== undefined) {
            update.description = String(description || '').trim();
        }
        if (coverImage !== undefined) {
            update.coverImage = coverImage ? String(coverImage).trim() : null;
        }
        if (isActive !== undefined) {
            if (typeof isActive !== 'boolean') {
                return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
            }
            update.isActive = isActive;
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        const group = await ensureGeneralGroup();
        const updated = await Group.findByIdAndUpdate(group._id, { $set: update }, { new: true });

        res.status(200).json({
            success: true,
            message: 'General community updated',
            data: formatGeneralGroup(updated),
        });
    } catch (error) {
        console.error('Update General Group Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update the General group',
            error: error.message,
        });
    }
};
