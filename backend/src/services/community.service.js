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

export const isPublicGroup = (group) =>
  group?.isPublic === true || group?.planSlug === 'general';

export const getPublicGroupIds = async () => {
  const groups = await Group.find({ $or: [{ isPublic: true }, { planSlug: 'general' }] })
    .select('_id')
    .lean();
  return groups.map((g) => g._id);
};
