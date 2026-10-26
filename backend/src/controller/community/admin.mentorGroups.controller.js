import mongoose from 'mongoose';
import { Group, MentorProfile } from '../../models/community.models.js';
import { User } from '../../models/user.models.js';
import Notification from '../../models/notification.models.js';
import { sendPushToUser } from '../../services/pushService.js';
import { getScopedIds } from '../../middleware/permissionScope.js';
import {
  addMentorGroupMembers,
  archiveMentorGroup,
  buildMentorGroupMembers,
  createPrivateMentorGroup,
  detachMentorGroupCommunity,
  removeMentorGroupDirectMember,
} from '../../services/mentorGroup.service.js';

const formatGroup = (group) => {
  const owner = group.ownerId;
  return {
    _id: group._id,
    name: group.name,
    description: group.description || '',
    coverImage: group.coverImage || null,
    memberCount: group.memberCount || 0,
    isActive: group.isActive !== false,
    owner: owner && typeof owner === 'object' && owner._id
      ? {
          _id: owner._id,
          displayName: owner.displayName || 'Mentor',
          email: owner.email || null,
          photoURL: owner.photoURL || null,
        }
      : null,
    ownerId: owner && typeof owner === 'object' && owner._id ? owner._id : owner,
    linkedGroups: (group.linkedGroupIds || [])
      .filter((linked) => linked && typeof linked === 'object' && linked._id)
      .map((linked) => ({
        _id: linked._id,
        name: linked.name,
        groupType: linked.groupType,
      })),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
};

const groupQuery = (groupId) => Group.findOne({
  _id: groupId,
  groupType: 'mentor',
  isActive: true,
})
  .populate('ownerId', 'displayName email photoURL')
  .populate('linkedGroupIds', 'name groupType');

const handleError = (res, error, fallback) => {
  console.error(fallback, error);
  return res.status(error.status || 500).json({
    success: false,
    message: error.message || fallback,
    ...(error.code ? { code: error.code } : {}),
  });
};

const notifyAddedUsers = async (userIds, group) => {
  for (const userId of userIds) {
    try {
      await Notification.createNotification({
        user: userId,
        type: 'mentor_group_added',
        title: `Added to ${group.name}`,
        message: 'You now have access to this private mentor group.',
        actionUrl: '/(home)/community',
        icon: '🔐',
      });
      await sendPushToUser(userId, {
        title: `Added to ${group.name}`,
        body: 'You now have access to this private mentor group.',
        data: { type: 'mentor_group_added', actionUrl: '/(home)/community' },
      });
    } catch (error) {
      console.error('Mentor group notification failed:', error?.message);
    }
  }
};

export const listMentorGroupsAdmin = async (req, res) => {
  try {
    const query = { groupType: 'mentor', isActive: true };
    const scopedGroupIds = getScopedIds(req.admin, 'manage_mentor_groups');
    if (scopedGroupIds !== null) {
      query._id = { $in: scopedGroupIds };
    }

    const groups = await Group.find(query)
      .populate('ownerId', 'displayName email photoURL')
      .populate('linkedGroupIds', 'name groupType')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: groups.map(formatGroup) });
  } catch (error) {
    return handleError(res, error, 'Failed to retrieve mentor groups');
  }
};

export const createMentorGroupAdmin = async (req, res) => {
  try {
    const ownerUserId = String(req.body.ownerUserId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(ownerUserId)) {
      return res.status(400).json({ success: false, message: 'Select a mentor owner' });
    }

    const group = await createPrivateMentorGroup({
      ownerUserId,
      name: req.body.name,
      description: req.body.description,
      coverImage: req.body.coverImage,
    });

    const populated = await groupQuery(group._id).lean();
    return res.status(201).json({
      success: true,
      message: 'Mentor group created',
      data: formatGroup(populated),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to create mentor group');
  }
};

export const getMentorGroupAdmin = async (req, res) => {
  try {
    const group = await groupQuery(req.params.groupId).lean();
    if (!group) {
      return res.status(404).json({ success: false, message: 'Mentor group not found' });
    }
    return res.status(200).json({ success: true, data: formatGroup(group) });
  } catch (error) {
    return handleError(res, error, 'Failed to retrieve mentor group');
  }
};

export const updateMentorGroupAdmin = async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      groupType: 'mentor',
      isActive: true,
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Mentor group not found' });
    }

    const name = req.body.name !== undefined ? String(req.body.name || '').trim() : group.name;
    const description = req.body.description !== undefined
      ? String(req.body.description || '').trim()
      : group.description;
    const coverImage = req.body.coverImage !== undefined
      ? (String(req.body.coverImage || '').trim() || null)
      : group.coverImage;

    if (name.length < 3 || name.length > 80) {
      return res.status(400).json({
        success: false,
        message: 'Group name must be between 3 and 80 characters',
      });
    }
    if (description.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Group description cannot exceed 500 characters',
      });
    }

    group.name = name;
    group.description = description;
    group.coverImage = coverImage;
    await group.save();

    const populated = await groupQuery(group._id).lean();
    return res.status(200).json({
      success: true,
      message: 'Mentor group updated',
      data: formatGroup(populated),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to update mentor group');
  }
};

export const archiveMentorGroupAdmin = async (req, res) => {
  try {
    const group = await archiveMentorGroup(req.params.groupId);
    return res.status(200).json({
      success: true,
      message: 'Mentor group archived',
      data: { _id: group._id },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to archive mentor group');
  }
};

export const listMentorOwnerOptions = async (req, res) => {
  try {
    const profiles = await MentorProfile.find({ isActive: true, isVerified: true })
      .populate('userId', 'displayName email photoURL isActive')
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: profiles
        .filter((profile) => profile.userId && profile.userId.isActive !== false)
        .map((profile) => ({
          _id: profile.userId._id,
          profileId: profile._id,
          displayName: profile.userId.displayName,
          email: profile.userId.email || null,
          photoURL: profile.userId.photoURL || null,
          headline: profile.headline || '',
        })),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to retrieve mentor owners');
  }
};

export const listMentorGroupCommunities = async (req, res) => {
  try {
    const groups = await Group.find({
      isActive: true,
      groupType: { $ne: 'mentor' },
    })
      .select('name groupType memberCount planSlug category')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({ success: true, data: groups });
  } catch (error) {
    return handleError(res, error, 'Failed to retrieve communities');
  }
};

export const searchMentorGroupUsers = async (req, res) => {
  try {
    const search = String(req.query.q || '').trim();
    const query = { isActive: { $ne: false } };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { displayName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('displayName email photoURL')
      .sort({ displayName: 1 })
      .limit(30)
      .lean();

    return res.status(200).json({
      success: true,
      data: users.map((user) => ({
        _id: user._id,
        displayName: user.displayName,
        email: user.email || null,
        photoURL: user.photoURL || null,
      })),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to search users');
  }
};

export const getMentorGroupMembersAdmin = async (req, res) => {
  try {
    const group = await groupQuery(req.params.groupId).lean();
    if (!group) {
      return res.status(404).json({ success: false, message: 'Mentor group not found' });
    }

    const members = await buildMentorGroupMembers(group._id);
    return res.status(200).json({
      success: true,
      data: {
        group: formatGroup(group),
        members,
      },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to retrieve group members');
  }
};

export const addMentorGroupMembersAdmin = async (req, res) => {
  try {
    const group = await groupQuery(req.params.groupId).lean();
    if (!group) {
      return res.status(404).json({ success: false, message: 'Mentor group not found' });
    }

    const result = await addMentorGroupMembers({
      group,
      userIds: req.body.userIds,
      groupIds: req.body.groupIds,
      actorUserId: group.ownerId?._id || group.ownerId,
      allowAnyCommunity: true,
    });

    if (result.directUserIds.length > 0) {
      await notifyAddedUsers(result.directUserIds, group);
    }

    const members = await buildMentorGroupMembers(group._id);
    const fresh = await groupQuery(group._id).lean();

    return res.status(200).json({
      success: true,
      message: 'Members updated',
      data: {
        ...result,
        group: formatGroup(fresh),
        members,
      },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to update group members');
  }
};

export const removeMentorGroupMemberAdmin = async (req, res) => {
  try {
    const result = await removeMentorGroupDirectMember(
      req.params.groupId,
      req.params.userId
    );
    return res.status(200).json({
      success: true,
      message: 'Member removed',
      data: result,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to remove group member');
  }
};

export const detachMentorGroupCommunityAdmin = async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      groupType: 'mentor',
      isActive: true,
    }).lean();

    if (!group) {
      return res.status(404).json({ success: false, message: 'Mentor group not found' });
    }

    const result = await detachMentorGroupCommunity(group, req.params.communityId);
    const fresh = await groupQuery(group._id).lean();

    return res.status(200).json({
      success: true,
      message: 'Community detached',
      data: {
        ...result,
        group: formatGroup(fresh),
      },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to detach community');
  }
};
