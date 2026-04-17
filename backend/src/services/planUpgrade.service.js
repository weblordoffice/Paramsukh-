import mongoose from 'mongoose';
import { User } from '../models/user.models.js';
import { Group, GroupMember } from '../models/community.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { normalizePlanSlug } from './membershipPlan.service.js';

const CATEGORY_LABELS = {
  physical: 'Physical',
  mental: 'Mental',
  financial: 'Financial',
  relationship: 'Relationship',
  spiritual: 'Spiritual',
  general: 'General',
};

const normalizeCategory = (value) => String(value || '').trim().toLowerCase();

const formatCategoryLabel = (category) => {
  const normalized = normalizeCategory(category);
  return CATEGORY_LABELS[normalized] || (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'General');
};

const formatPlanLabel = (planSlug) => {
  const normalized = normalizePlanSlug(planSlug);
  if (!normalized) {
    return 'Plan';
  }
  return normalized
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const asObjectId = (value) => {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  if (mongoose.Types.ObjectId.isValid(String(value))) {
    return new mongoose.Types.ObjectId(String(value));
  }
  return value;
};

const isDuplicateKeyError = (error) => {
  if (error?.code === 11000) {
    return true;
  }
  if (Array.isArray(error?.writeErrors) && error.writeErrors.length > 0) {
    return error.writeErrors.every((entry) => entry?.code === 11000);
  }
  return false;
};

const resolveUserEnrolledCategories = async (userId) => {
  const enrollments = await Enrollment.find({ userId })
    .populate({ path: 'courseId', select: 'category' })
    .select('courseId')
    .lean();

  const categories = new Set();
  enrollments.forEach((enrollment) => {
    const category = normalizeCategory(enrollment?.courseId?.category);
    if (category) {
      categories.add(category);
    }
  });

  return Array.from(categories);
};

const ensurePlanCategoryGroups = async ({ planSlug, categories = [] }) => {
  const normalizedPlan = normalizePlanSlug(planSlug);
  if (!normalizedPlan || normalizedPlan === 'free' || !categories.length) {
    return [];
  }

  const planLabel = formatPlanLabel(normalizedPlan);

  try {
    await Group.bulkWrite(
      categories.map((category) => ({
        updateOne: {
          filter: { groupType: 'category', planSlug: normalizedPlan, category },
          update: {
            $setOnInsert: {
              groupType: 'category',
              planSlug: normalizedPlan,
              category,
              name: `${planLabel} - ${formatCategoryLabel(category)} Community`,
              description: `${planLabel} members enrolled in ${formatCategoryLabel(category)} courses`,
              memberCount: 0,
            },
            $set: {
              isActive: true,
              name: `${planLabel} - ${formatCategoryLabel(category)} Community`,
              description: `${planLabel} members enrolled in ${formatCategoryLabel(category)} courses`,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }

  return Group.find({ groupType: 'category', planSlug: normalizedPlan, category: { $in: categories } })
    .select('_id planSlug category name memberCount')
    .lean();
};

const refreshGroupMemberCounts = async (groupIds = []) => {
  const uniqueGroupIds = Array.from(new Set(groupIds.map((id) => String(id)).filter(Boolean)));
  if (!uniqueGroupIds.length) {
    return;
  }

  const objectIds = uniqueGroupIds.map((id) => asObjectId(id));
  const counts = await GroupMember.aggregate([
    { $match: { groupId: { $in: objectIds }, isActive: true } },
    { $group: { _id: '$groupId', count: { $sum: 1 } } },
  ]);

  const countsByGroupId = new Map(counts.map((item) => [String(item._id), item.count]));

  await Group.bulkWrite(
    objectIds.map((groupId) => ({
      updateOne: {
        filter: { _id: groupId },
        update: { $set: { memberCount: countsByGroupId.get(String(groupId)) || 0 } },
      },
    })),
    { ordered: false }
  );
};

export const syncUserCommunityMembershipsByPlan = async ({ userId, planSlug, membershipActive = true }) => {
  const normalizedUserId = asObjectId(userId);
  const normalizedPlan = normalizePlanSlug(planSlug || 'free');
  const shouldSyncActivePlan = membershipActive && normalizedPlan && normalizedPlan !== 'free';

  // New architecture: groups are plan-specific and only for categories user is enrolled in.
  const categories = shouldSyncActivePlan ? await resolveUserEnrolledCategories(normalizedUserId) : [];
  const groups = await ensurePlanCategoryGroups({ planSlug: normalizedPlan, categories });
  const targetGroupIds = groups.map((group) => String(group._id));
  const targetGroupIdSet = new Set(targetGroupIds);

  const existingMembershipsInTarget = targetGroupIds.length
    ? await GroupMember.find({ userId: normalizedUserId, groupId: { $in: targetGroupIds } })
        .select('_id groupId isActive')
        .lean()
    : [];

  const activeCategoryMemberships = await GroupMember.aggregate([
    { $match: { userId: normalizedUserId, isActive: true } },
    {
      $lookup: {
        from: 'groups',
        localField: 'groupId',
        foreignField: '_id',
        as: 'group',
      },
    },
    { $unwind: '$group' },
    {
      $match: {
        'group.groupType': 'category',
        'group.planSlug': { $type: 'string' },
      },
    },
    { $project: { _id: 1, groupId: 1 } },
  ]);

  const existingByGroupId = new Map(existingMembershipsInTarget.map((membership) => [String(membership.groupId), membership]));

  const createMembershipDocs = [];
  const reactivateMembershipIds = [];

  targetGroupIds.forEach((groupId) => {
    const existing = existingByGroupId.get(groupId);
    if (!existing) {
      createMembershipDocs.push({
        groupId: asObjectId(groupId),
        userId: normalizedUserId,
        role: 'member',
        isActive: true,
      });
      return;
    }

    if (!existing.isActive) {
      reactivateMembershipIds.push(existing._id);
    }
  });

  const deactivateMembershipIds = activeCategoryMemberships
    .filter((membership) => !targetGroupIdSet.has(String(membership.groupId)))
    .map((membership) => membership._id);

  if (createMembershipDocs.length > 0) {
    try {
      await GroupMember.insertMany(createMembershipDocs, { ordered: false });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  if (reactivateMembershipIds.length > 0) {
    await GroupMember.updateMany(
      { _id: { $in: reactivateMembershipIds }, isActive: false },
      { $set: { isActive: true } }
    );
  }

  if (deactivateMembershipIds.length > 0) {
    await GroupMember.updateMany(
      { _id: { $in: deactivateMembershipIds }, isActive: true },
      { $set: { isActive: false } }
    );
  }

  const touchedGroupIds = [
    ...targetGroupIds,
    ...activeCategoryMemberships
      .filter((membership) => !targetGroupIdSet.has(String(membership.groupId)))
      .map((membership) => String(membership.groupId)),
  ];

  await refreshGroupMemberCounts(touchedGroupIds);

  return {
    success: true,
    planSlug: normalizedPlan,
    categories,
    groupsEnsured: groups.length,
    createdMemberships: createMembershipDocs.length,
    reactivatedMemberships: reactivateMembershipIds.length,
    deactivatedMemberships: deactivateMembershipIds.length,
  };
};

/**
 * Handle community group enrollment when user upgrades their plan
 * Automatically enrolls user in new groups for courses included in the new plan
 */
export const handlePlanUpgrade = async (userId, newPlanSlug) => {
  try {
    console.log(`⬆️ Handling plan-category community sync for user ${userId} on plan ${newPlanSlug}`);

    const result = await syncUserCommunityMembershipsByPlan({
      userId,
      planSlug: newPlanSlug,
      membershipActive: true,
    });

    return {
      success: true,
      planSlug: result.planSlug,
      enrolledInGroups: result.createdMemberships + result.reactivatedMemberships,
      deactivatedGroups: result.deactivatedMemberships,
      totalCategories: result.categories.length,
    };
  } catch (error) {
    console.error('❌ Error handling plan upgrade:', error);
    throw error;
  }
};

/**
 * Sync user's community memberships with their current plan
 * Use this when user manually triggers a refresh or after plan change
 */
export const syncUserCommunityMemberships = async (userId) => {
  try {
    console.log(`🔄 Syncing plan-category community memberships for user ${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const result = await syncUserCommunityMembershipsByPlan({
      userId,
      planSlug: user.subscriptionPlan,
      membershipActive: user.subscriptionStatus === 'active',
    });

    console.log(
      `✅ Sync complete. categoryGroups=${result.groupsEnsured}, created=${result.createdMemberships}, reactivated=${result.reactivatedMemberships}, deactivated=${result.deactivatedMemberships}`
    );

    return {
      success: true,
      planSlug: result.planSlug,
      activeInGroups: result.groupsEnsured,
      created: result.createdMemberships,
      reactivated: result.reactivatedMemberships,
      deactivated: result.deactivatedMemberships,
    };
  } catch (error) {
    console.error('❌ Error syncing community memberships:', error);
    throw error;
  }
};
