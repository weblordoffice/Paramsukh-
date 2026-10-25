import { Group, GroupMember } from '../models/community.models.js';

const GENERAL_GROUP_FILTER = { groupType: 'plan', planSlug: 'general' };

/**
 * Idempotently ensure the single General (public) community group exists.
 * Only sets isActive on insert so an admin "disable" is not overridden.
 */
export const ensureGeneralGroup = async () => {
  return Group.findOneAndUpdate(
    GENERAL_GROUP_FILTER,
    {
      $set: { isPublic: true },
      $setOnInsert: {
        name: 'General Community',
        description: 'A public space for all users. Join the conversation!',
        groupType: 'plan',
        planSlug: 'general',
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Atomic GroupMember upsert; increments memberCount only on a genuine insert.
 */
export const enrollUserInGroup = async (groupId, userId) => {
  if (!groupId || !userId) return null;

  const result = await GroupMember.findOneAndUpdate(
    { groupId, userId },
    { $setOnInsert: { groupId, userId, role: 'member' }, $set: { isActive: true } },
    { upsert: true, new: true, rawResult: true }
  );

  if (!result.lastErrorObject?.updatedExisting) {
    await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } });
    console.log(`👤 Enrolled user ${userId} in group ${groupId}`);
  }

  return result.value;
};

/**
 * Assign a user as a mentor to a group. Creates or reactivates the
 * GroupMember row with role=mentor and keeps memberCount accurate.
 */
export const assignMentorToGroup = async (userId, groupId) => {
  if (!userId || !groupId) return null;

  const existing = await GroupMember.findOne({ groupId, userId })
    .select('isActive')
    .lean();

  const result = await GroupMember.findOneAndUpdate(
    { groupId, userId },
    {
      $set: { isActive: true, role: 'mentor' },
      $setOnInsert: { groupId, userId },
    },
    { upsert: true, new: true, rawResult: true }
  );

  const becameActive = !existing || existing.isActive === false;
  if (becameActive) {
    await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } });
  }

  return result.value;
};

/**
 * Remove a mentor assignment from a group. Only deactivates rows that are
 * still marked as mentor, so normal plan memberships are untouched.
 */
export const removeMentorFromGroup = async (userId, groupId) => {
  if (!userId || !groupId) return null;

  const membership = await GroupMember.findOne({
    groupId,
    userId,
    isActive: true,
    role: 'mentor',
  });

  if (!membership) return null;

  membership.isActive = false;
  await membership.save();
  await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: -1 } });

  return membership;
};

export const isPublicGroup = (group) =>
  group?.isPublic === true || group?.planSlug === 'general';

export const syncGroupMemberCount = async (groupId) => {
  if (!groupId) return 0;
  const count = await GroupMember.countDocuments({ groupId, isActive: true });
  await Group.findByIdAndUpdate(groupId, { $set: { memberCount: count } });
  return count;
};

/**
 * Grant access to every active member of the given source communities.
 * Existing memberships are reactivated without losing a direct-membership source.
 */
export const enrollMembersFromGroups = async (groupId, sourceGroupIds = []) => {
  const linkedGroupIds = [...new Set(
    (Array.isArray(sourceGroupIds) ? sourceGroupIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )];

  if (linkedGroupIds.length === 0) {
    const total = await syncGroupMemberCount(groupId);
    return { added: 0, total };
  }

  const sourceMembers = await GroupMember.find({
    groupId: { $in: linkedGroupIds },
    isActive: true,
  }).select('userId groupId').lean();

  const sourceByUserId = new Map();
  sourceMembers.forEach((membership) => {
    const userId = String(membership.userId);
    if (!sourceByUserId.has(userId)) sourceByUserId.set(userId, membership.groupId);
  });

  const userIds = [...sourceByUserId.keys()];
  const existing = await GroupMember.find({
    groupId,
    userId: { $in: userIds },
  }).select('userId').lean();
  const existingIds = new Set(existing.map((membership) => String(membership.userId)));

  const newUserIds = userIds.filter((userId) => !existingIds.has(userId));

  if (newUserIds.length > 0) {
    await GroupMember.bulkWrite(
      newUserIds.map((userId) => ({
        updateOne: {
          filter: { groupId, userId },
          update: {
            $setOnInsert: {
              groupId,
              userId,
              role: 'member',
              sourceGroupId: sourceByUserId.get(userId) || null,
              joinedAt: new Date(),
            },
            $set: { isActive: true },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }

  // Reactivate previously inherited memberships that still have a live source.
  if (userIds.length > 0) {
    await GroupMember.updateMany(
      { groupId, userId: { $in: userIds }, isActive: false },
      { $set: { isActive: true } }
    );
  }

  const total = await syncGroupMemberCount(groupId);
  return { added: newUserIds.length, total };
};

/**
 * Ensure a user can access a private mentor group. Access is granted to the
 * owner, mentors, directly-added members, and active members of linked communities.
 * Linked membership is materialized/synced on access so future members are covered.
 */
export const ensureMentorGroupAccess = async (group, userId) => {
  if (!group || group.groupType !== 'mentor' || !userId) {
    return { allowed: false };
  }

  if (group.ownerId && String(group.ownerId) === String(userId)) {
    return { allowed: true, via: 'owner' };
  }

  const membership = await GroupMember.findOne({
    groupId: group._id,
    userId,
    isActive: true,
  }).lean();

  if (membership) {
    if (membership.role === 'mentor' || !membership.sourceGroupId) {
      return { allowed: true, membership, via: membership.role === 'mentor' ? 'mentor' : 'direct' };
    }

    const linkedIds = group.linkedGroupIds || [];
    const source = linkedIds.length > 0
      ? await GroupMember.findOne({
          userId,
          isActive: true,
          groupId: { $in: linkedIds },
        }).select('groupId').lean()
      : null;

    if (source) {
      if (String(membership.sourceGroupId) !== String(source.groupId)) {
        await GroupMember.updateOne(
          { _id: membership._id },
          { $set: { sourceGroupId: source.groupId } }
        );
      }
      return { allowed: true, membership, via: 'community' };
    }

    await GroupMember.updateOne({ _id: membership._id }, { $set: { isActive: false } });
    await syncGroupMemberCount(group._id);
    return { allowed: false };
  }

  const linkedIds = group.linkedGroupIds || [];
  if (linkedIds.length === 0) return { allowed: false };

  const source = await GroupMember.findOne({
    userId,
    isActive: true,
    groupId: { $in: linkedIds },
  }).select('groupId').lean();

  if (!source) return { allowed: false };

  await GroupMember.updateOne(
    { groupId: group._id, userId },
    {
      $setOnInsert: {
        groupId: group._id,
        userId,
        role: 'member',
        joinedAt: new Date(),
      },
      $set: {
        isActive: true,
        sourceGroupId: source.groupId,
      },
    },
    { upsert: true }
  );
  await syncGroupMemberCount(group._id);

  return { allowed: true, via: 'community' };
};

export const getPublicGroupIds = async () => {
  const groups = await Group.find({ $or: [{ isPublic: true }, { planSlug: 'general' }] })
    .select('_id')
    .lean();
  return groups.map((g) => g._id);
};
