import mongoose from 'mongoose';
import { User } from '../models/user.models.js';
import { Group, GroupMember } from '../models/community.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { Course } from '../models/course.models.js';
import { CoursePlan } from '../models/coursePlan.models.js';
import { normalizePlanSlug, resolveMembershipPlanInheritanceBySlug } from './membershipPlan.service.js';

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

const resolvePlanCommunityCategories = async (planSlug) => {
  const normalizedPlan = normalizePlanSlug(planSlug);
  if (!normalizedPlan || normalizedPlan === 'free') {
    return [];
  }

  try {
    const inheritance = await resolveMembershipPlanInheritanceBySlug(normalizedPlan);
    const categories = new Set();

    const planIds = inheritance.planIds.length > 0 ? inheritance.planIds : [];
    const planSlugs = inheritance.planSlugs.length > 0 ? inheritance.planSlugs : [normalizedPlan];

    // Prefer the normalized junction table, but also fall back to the legacy
    // course.includedInPlans field so older plans still sync correctly.
    const legacyCourses = await Course.find({
      status: 'published',
      includedInPlans: { $in: planSlugs },
    })
      .select('category')
      .lean();

    legacyCourses.forEach((course) => {
      const normalizedCategory = normalizeCategory(course?.category);
      if (normalizedCategory) {
        categories.add(normalizedCategory);
      }
    });

    if (planIds.length === 0) {
      return Array.from(categories);
    }

    const coursePlanLinks = await CoursePlan.find({ planId: { $in: planIds } })
      .select('courseId')
      .lean();

    const courseIds = coursePlanLinks.map((link) => String(link.courseId)).filter(Boolean);
    if (courseIds.length === 0) {
      return [];
    }

    const courses = await Course.find({ _id: { $in: courseIds }, status: 'published' })
      .select('category')
      .lean();

    courses.forEach((course) => {
      const normalizedCategory = normalizeCategory(course?.category);
      if (normalizedCategory) {
        categories.add(normalizedCategory);
      }
    });

    return Array.from(categories);
  } catch (error) {
    return [];
  }
};

const ensurePlanCategoryGroups = async ({ planSlug, categories = [], parentGroupId = null }) => {
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
              parentGroupId: parentGroupId || null,
            },
            $set: {
              isActive: true,
              name: `${planLabel} - ${formatCategoryLabel(category)} Community`,
              description: `${planLabel} members enrolled in ${formatCategoryLabel(category)} courses`,
              parentGroupId: parentGroupId || null,
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
    .select('_id planSlug category name memberCount parentGroupId')
    .lean();
};

/**
 * Ensure a plan-level parent group exists for the given plan slug.
 * Returns the group document (created or existing).
 */
const ensurePlanParentGroup = async (planSlug) => {
  const normalizedPlan = normalizePlanSlug(planSlug);
  if (!normalizedPlan || normalizedPlan === 'free') {
    return null;
  }

  const planLabel = formatPlanLabel(normalizedPlan);
  const filter = { groupType: 'plan', planSlug: normalizedPlan };

  try {
    const group = await Group.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          groupType: 'plan',
          planSlug: normalizedPlan,
          category: null,
          parentGroupId: null,
          name: `${planLabel} Community`,
          description: `Community for ${planLabel} plan members`,
          memberCount: 0,
        },
        $set: {
          isActive: true,
          name: `${planLabel} Community`,
          description: `Community for ${planLabel} plan members`,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return group;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // Race condition: another request created it first — just fetch it
      return Group.findOne(filter).lean();
    }
    throw error;
  }
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

  // Resolve plan inheritance: e.g., Gold inherits Silver
  let allPlanSlugs = [normalizedPlan];
  if (shouldSyncActivePlan) {
    try {
      const inheritance = await resolveMembershipPlanInheritanceBySlug(normalizedPlan);
      if (inheritance.planSlugs.length > 0) {
        allPlanSlugs = inheritance.planSlugs;
      }
    } catch (err) {
      console.error(`⚠️ Failed to resolve plan inheritance for ${normalizedPlan}:`, err.message);
    }
  }

  // Get user's enrolled categories and any categories directly configured on the plan.
  const enrolledCategories = shouldSyncActivePlan ? await resolveUserEnrolledCategories(normalizedUserId) : [];
  const planCategories = shouldSyncActivePlan ? await resolvePlanCommunityCategories(normalizedPlan) : [];
  const categories = Array.from(new Set([...enrolledCategories, ...planCategories]));

  // For each plan slug (including inherited), ensure parent group + category subgroups
  const allParentGroups = [];
  const allCategoryGroups = [];

  if (shouldSyncActivePlan) {
    for (const slug of allPlanSlugs) {
      const normalized = normalizePlanSlug(slug);
      if (!normalized || normalized === 'free') continue;

      // 1. Ensure plan-level parent group
      const parentGroup = await ensurePlanParentGroup(normalized);
      if (parentGroup) {
        allParentGroups.push(parentGroup);

        // 2. Ensure category subgroups under this parent
        const subgroups = await ensurePlanCategoryGroups({
          planSlug: normalized,
          categories,
          parentGroupId: parentGroup._id,
        });
        allCategoryGroups.push(...subgroups);
      }
    }
  }

  // Build the full list of target group IDs (parents + subgroups)
  const targetGroupIds = [
    ...allParentGroups.map((g) => String(g._id)),
    ...allCategoryGroups.map((g) => String(g._id)),
  ];
  const targetGroupIdSet = new Set(targetGroupIds);

  const existingMembershipsInTarget = targetGroupIds.length
    ? await GroupMember.find({ userId: normalizedUserId, groupId: { $in: targetGroupIds } })
        .select('_id groupId isActive')
        .lean()
    : [];

  // Find all current active plan+category memberships to detect ones that need deactivation
  const activePlanCategoryMemberships = await GroupMember.aggregate([
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
        $or: [
          { 'group.groupType': 'category', 'group.planSlug': { $type: 'string' } },
          { 'group.groupType': 'plan', 'group.planSlug': { $type: 'string' } },
        ],
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

  const deactivateMembershipIds = activePlanCategoryMemberships
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
    ...activePlanCategoryMemberships
      .filter((membership) => !targetGroupIdSet.has(String(membership.groupId)))
      .map((membership) => String(membership.groupId)),
  ];

  await refreshGroupMemberCounts(touchedGroupIds);

  return {
    success: true,
    planSlug: normalizedPlan,
    allPlanSlugs,
    categories,
    parentGroupsEnsured: allParentGroups.length,
    categoryGroupsEnsured: allCategoryGroups.length,
    groupsEnsured: allParentGroups.length + allCategoryGroups.length,
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
