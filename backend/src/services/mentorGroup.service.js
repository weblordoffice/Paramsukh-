import mongoose from 'mongoose';
import { Group, GroupMember, MentorProfile } from '../models/community.models.js';
import { User } from '../models/user.models.js';
import {
  assignMentorToGroup,
  enrollMembersFromGroups,
  syncGroupMemberCount,
} from './community.service.js';

const httpError = (status, message, code = null) => {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
};

export const isMentorForGroup = async (userId, groupId) => {
  const [membership, profile] = await Promise.all([
    GroupMember.findOne({ groupId, userId, isActive: true, role: 'mentor' })
      .select('_id')
      .lean(),
    MentorProfile.findOne({ userId, isActive: true, groupIds: groupId })
      .select('_id')
      .lean(),
  ]);
  return Boolean(membership || profile);
};

export const createPrivateMentorGroup = async ({
  ownerUserId,
  name,
  description = '',
  coverImage = null,
}) => {
  const profile = await MentorProfile.findOne({
    userId: ownerUserId,
    isActive: true,
    isVerified: true,
  }).select('_id');

  if (!profile) {
    throw httpError(400, 'The selected owner is not an active verified mentor', 'INVALID_MENTOR');
  }

  const cleanName = String(name || '').trim();
  const cleanDescription = String(description || '').trim();

  if (cleanName.length < 3 || cleanName.length > 80) {
    throw httpError(400, 'Group name must be between 3 and 80 characters');
  }
  if (cleanDescription.length > 500) {
    throw httpError(400, 'Group description cannot exceed 500 characters');
  }

  const existing = await Group.findOne({
    ownerId: ownerUserId,
    groupType: 'mentor',
    name: cleanName,
    isActive: true,
  }).select('_id').lean();

  if (existing) {
    throw httpError(409, 'This mentor already has a private group with this name');
  }

  const group = await Group.create({
    groupType: 'mentor',
    ownerId: ownerUserId,
    name: cleanName,
    description: cleanDescription,
    coverImage: String(coverImage || '').trim() || null,
    isPublic: false,
    memberCount: 0,
    isActive: true,
  });

  await MentorProfile.updateOne(
    { _id: profile._id },
    { $addToSet: { groupIds: group._id } }
  );
  await assignMentorToGroup(ownerUserId, group._id);

  return Group.findById(group._id).lean();
};

export const buildMentorGroupMembers = async (groupId) => {
  const members = await GroupMember.find({ groupId, isActive: true })
    .populate('userId', 'displayName photoURL email isActive')
    .sort({ role: 1, joinedAt: 1 })
    .lean();

  const sourceIds = [...new Set(
    members.map((member) => member.sourceGroupId).filter(Boolean).map(String)
  )];
  const sourceGroups = sourceIds.length > 0
    ? await Group.find({ _id: { $in: sourceIds } }).select('name').lean()
    : [];
  const sourceNameById = new Map(
    sourceGroups.map((group) => [String(group._id), group.name])
  );

  return members
    .filter((member) => member.userId && member.userId.isActive !== false)
    .map((member) => ({
      _id: member._id,
      userId: member.userId._id,
      displayName: member.userId.displayName,
      email: member.userId.email || null,
      photoURL: member.userId.photoURL || null,
      role: member.role,
      isDirect: !member.sourceGroupId,
      sourceGroupId: member.sourceGroupId || null,
      sourceGroupName: member.sourceGroupId
        ? (sourceNameById.get(String(member.sourceGroupId)) || 'Community')
        : null,
      joinedAt: member.joinedAt,
    }));
};

export const addMentorGroupMembers = async ({
  group,
  userIds = [],
  groupIds = [],
  actorUserId,
  allowAnyCommunity = false,
}) => {
  const directUserIds = [...new Set(
    (Array.isArray(userIds) ? userIds : [])
      .map((id) => String(id || '').trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
  )].filter((id) => id !== String(group.ownerId));

  const requestedGroupIds = [...new Set(
    (Array.isArray(groupIds) ? groupIds : [])
      .map((id) => String(id || '').trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
  )].filter((id) => id !== String(group._id));

  if (directUserIds.length === 0 && requestedGroupIds.length === 0) {
    throw httpError(400, 'Select at least one person or community');
  }

  const validSourceGroups = [];
  for (const sourceGroupId of requestedGroupIds) {
    const sourceGroup = await Group.findOne({
      _id: sourceGroupId,
      isActive: true,
      groupType: { $ne: 'mentor' },
    }).select('_id').lean();

    if (!sourceGroup) continue;
    if (allowAnyCommunity || await isMentorForGroup(actorUserId, sourceGroup._id)) {
      validSourceGroups.push(sourceGroup._id);
    }
  }

  if (validSourceGroups.length > 0) {
    await Group.updateOne(
      { _id: group._id },
      { $addToSet: { linkedGroupIds: { $each: validSourceGroups } } }
    );
  }

  const communityEnrollment = await enrollMembersFromGroups(
    group._id,
    validSourceGroups
  );

  let addedDirect = 0;
  const validDirectUserIds = [];

  if (directUserIds.length > 0) {
    const users = await User.find({
      _id: { $in: directUserIds },
      isActive: { $ne: false },
    }).select('_id').lean();
    const userMap = new Map(users.map((entry) => [String(entry._id), entry._id]));

    let eligibleUserIds = null;
    if (!allowAnyCommunity) {
      const profile = await MentorProfile.findOne({
        userId: actorUserId,
        isActive: true,
      }).select('groupIds').lean();
      const mentorMemberships = await GroupMember.find({
        userId: actorUserId,
        isActive: true,
        role: 'mentor',
      }).select('groupId').lean();

      const mentorGroupIds = [...new Set([
        ...((profile?.groupIds || []).map(String)),
        ...mentorMemberships.map((membership) => String(membership.groupId)),
      ])];

      const memberships = mentorGroupIds.length > 0
        ? await GroupMember.find({
            userId: { $in: directUserIds },
            groupId: { $in: mentorGroupIds },
            isActive: true,
          }).select('userId').lean()
        : [];

      eligibleUserIds = new Set(
        memberships.map((membership) => String(membership.userId))
      );
    }

    const existingMembers = await GroupMember.find({
      groupId: group._id,
      userId: { $in: directUserIds },
    }).select('userId isActive sourceGroupId').lean();
    const existingMap = new Map(
      existingMembers.map((membership) => [String(membership.userId), membership])
    );

    for (const id of directUserIds) {
      if (!userMap.has(id)) continue;
      if (eligibleUserIds && !eligibleUserIds.has(id)) continue;

      validDirectUserIds.push(userMap.get(id));
      const existing = existingMap.get(id);
      if (!existing || existing.isActive === false || existing.sourceGroupId) {
        addedDirect += 1;
      }
    }

    if (validDirectUserIds.length > 0) {
      await GroupMember.bulkWrite(
        validDirectUserIds.map((directUserId) => ({
          updateOne: {
            filter: { groupId: group._id, userId: directUserId },
            update: {
              $setOnInsert: {
                groupId: group._id,
                userId: directUserId,
                role: 'member',
                joinedAt: new Date(),
              },
              $set: {
                isActive: true,
                sourceGroupId: null,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    }
  }

  const memberCount = await syncGroupMemberCount(group._id);
  const freshGroup = await Group.findById(group._id).select('linkedGroupIds').lean();

  return {
    addedDirect,
    addedFromCommunities: communityEnrollment.added,
    memberCount,
    linkedGroupIds: (freshGroup?.linkedGroupIds || []).map(String),
    directUserIds: validDirectUserIds.map(String),
  };
};

export const removeMentorGroupDirectMember = async (groupId, userId) => {
  const group = await Group.findOne({
    _id: groupId,
    groupType: 'mentor',
    isActive: true,
  }).select('ownerId').lean();

  if (!group) throw httpError(404, 'Mentor group not found');
  if (String(group.ownerId) === String(userId)) {
    throw httpError(400, 'The group owner cannot be removed');
  }

  const membership = await GroupMember.findOne({
    groupId,
    userId,
    isActive: true,
  });

  if (!membership) throw httpError(404, 'Member not found');
  if (membership.role === 'mentor') {
    throw httpError(400, 'Mentor members cannot be removed from the group');
  }
  if (membership.sourceGroupId) {
    throw httpError(400, 'This member is managed by a linked community. Detach the community instead.');
  }

  membership.isActive = false;
  await membership.save();
  const memberCount = await syncGroupMemberCount(groupId);

  return { removed: true, memberCount };
};

export const detachMentorGroupCommunity = async (group, communityId) => {
  const linkedIds = (group.linkedGroupIds || []).map(String);
  if (!linkedIds.includes(String(communityId))) {
    throw httpError(404, 'This community is not linked to the group');
  }

  const remainingLinkedIds = linkedIds.filter((id) => id !== String(communityId));

  await Group.updateOne(
    { _id: group._id },
    { $pull: { linkedGroupIds: new mongoose.Types.ObjectId(communityId) } }
  );

  const inherited = await GroupMember.find({
    groupId: group._id,
    isActive: true,
    sourceGroupId: communityId,
  }).select('_id userId').lean();

  const stillLinked = inherited.length > 0 && remainingLinkedIds.length > 0
    ? await GroupMember.find({
        userId: { $in: inherited.map((member) => member.userId) },
        isActive: true,
        groupId: { $in: remainingLinkedIds },
      }).select('userId groupId').lean()
    : [];
  const sourceByUserId = new Map(
    stillLinked.map((membership) => [String(membership.userId), membership.groupId])
  );

  let deactivated = 0;
  let relinked = 0;

  const operations = inherited.map((member) => {
    const replacementSource = sourceByUserId.get(String(member.userId));
    if (replacementSource) {
      relinked += 1;
      return {
        updateOne: {
          filter: { _id: member._id },
          update: { $set: { sourceGroupId: replacementSource } },
        },
      };
    }

    deactivated += 1;
    return {
      updateOne: {
        filter: { _id: member._id },
        update: { $set: { isActive: false } },
      },
    };
  });

  if (operations.length > 0) {
    await GroupMember.bulkWrite(operations, { ordered: false });
  }

  const memberCount = await syncGroupMemberCount(group._id);
  return { deactivated, relinked, memberCount };
};

export const archiveMentorGroup = async (groupId) => {
  const group = await Group.findOne({
    _id: groupId,
    groupType: 'mentor',
    isActive: true,
  });

  if (!group) throw httpError(404, 'Mentor group not found');

  group.isActive = false;
  await group.save();

  await MentorProfile.updateMany(
    { groupIds: group._id },
    { $pull: { groupIds: group._id } }
  );
  await GroupMember.updateMany(
    { groupId: group._id, isActive: true },
    { $set: { isActive: false } }
  );
  await syncGroupMemberCount(group._id);

  return group;
};
