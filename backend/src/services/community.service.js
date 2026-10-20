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

export const getPublicGroupIds = async () => {
  const groups = await Group.find({ $or: [{ isPublic: true }, { planSlug: 'general' }] })
    .select('_id')
    .lean();
  return groups.map((g) => g._id);
};
