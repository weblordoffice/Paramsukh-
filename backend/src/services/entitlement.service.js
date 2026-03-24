import { User } from '../models/user.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import { resolveMembershipPlanInheritanceFromPlan, normalizePlanSlug } from './membershipPlan.service.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

export const getUserEntitlementContext = async (userId) => {
  const user = await User.findById(userId)
    .select('subscriptionPlan subscriptionStatus subscriptionStartDate subscriptionEndDate')
    .lean();

  if (!user) {
    return null;
  }

  const activeMembership = await UserMembership.findOne({
    userId,
    status: 'active',
    endDate: { $gte: new Date() },
  })
    .populate('planId')
    .sort({ endDate: -1 })
    .lean();

  if (activeMembership?.planId) {
    const plan = activeMembership.planId;
    const inheritance = await resolveMembershipPlanInheritanceFromPlan(plan);
    const resolvedPlans = inheritance.plans.length > 0 ? inheritance.plans : [plan];
    const planSlugs = inheritance.planSlugs.length > 0 ? inheritance.planSlugs : [normalizePlanSlug(plan.slug)];

    const includedCategoriesSet = new Set();
    const includedCourseIdsSet = new Set();
    let communityAccess = false;

    resolvedPlans.forEach((resolved) => {
      (resolved.access?.includedCategories || []).forEach((cat) => includedCategoriesSet.add(normalize(cat)));
      (resolved.access?.includedCourseIds || []).forEach((id) => includedCourseIdsSet.add(String(id)));
      if (resolved.access?.communityAccess) {
        communityAccess = true;
      }
    });

    const maxCoursesTotal = plan.access?.limits?.maxCoursesTotal ?? null;
    const maxCategories = plan.access?.limits?.maxCategories ?? null;
    const perCategoryCourseLimit = plan.access?.limits?.perCategoryCourseLimit ?? null;

    return {
      source: 'dynamic',
      user,
      planSlug: normalize(plan.slug),
      planSlugs,
      accessMode: plan.access?.accessMode || 'entitlement_only',
      includedCategories: Array.from(includedCategoriesSet),
      includedCourseIds: Array.from(includedCourseIdsSet),
      maxCategories,
      maxCoursesTotal,
      perCategoryCourseLimit,
      communityAccess,
      isPaid: normalize(plan.slug) !== 'free',
    };
  }

  return {
    source: 'none',
    user,
    planSlug: 'free',
    planSlugs: ['free'],
    accessMode: 'entitlement_only',
    includedCategories: [],
    includedCourseIds: [],
    maxCategories: null,
    maxCoursesTotal: 0,
    perCategoryCourseLimit: null,
    communityAccess: false,
    isPaid: false,
  };
};

export const evaluateCourseEnrollmentAccess = async ({
  userId,
  course,
  currentEnrollments,
  distinctEnrolledCategoryCount = 0,
  isAlreadyUsingCourseCategory = false,
  enrollmentsInSameCategory = 0,
}) => {
  const entitlement = await getUserEntitlementContext(userId);

  if (!entitlement) {
    return {
      allowed: false,
      reason: 'user_not_found',
      message: 'User not found',
      statusCode: 404,
    };
  }

  if (!entitlement.isPaid) {
    return {
      allowed: false,
      reason: 'plan_required',
      message: 'This course requires an active membership plan.',
      statusCode: 403,
      upgradeRequired: true,
    };
  }

  const normalizedCategory = normalize(course.category);
  const allowedCategories = entitlement.includedCategories || [];
  const allowedCourseIds = entitlement.includedCourseIds || [];
  const normalizedPlanTags = (course.includedInPlans || []).map((plan) => normalize(plan));
  const allowedPlanSlugs = (entitlement.planSlugs || [entitlement.planSlug]).map((plan) => normalize(plan));
  const matchesPlanTag = normalizedPlanTags.some((plan) => allowedPlanSlugs.includes(plan));
  const categoryAllowed = allowedCategories.length === 0 || allowedCategories.includes(normalizedCategory);
  const explicitCourseAllowed = allowedCourseIds.includes(String(course._id));

  if (!categoryAllowed && !explicitCourseAllowed && !matchesPlanTag) {
    return {
      allowed: false,
      reason: 'category_not_included',
      message: `Your ${entitlement.planSlug} plan does not include this course category.`,
      statusCode: 403,
      upgradeRequired: true,
    };
  }

  if (entitlement.accessMode === 'auto_enroll') {
    return {
      allowed: false,
      reason: 'auto_enroll_only',
      message: `Your ${entitlement.planSlug} membership includes pre-selected courses. Manual enrollment is not available.`,
      statusCode: 403,
      restrictedPlan: true,
    };
  }

  const maxCategories = entitlement.maxCategories;
  const categoriesUnlimited = maxCategories === null || maxCategories === 'Infinity' || maxCategories === Infinity;
  if (!categoriesUnlimited && !isAlreadyUsingCourseCategory && distinctEnrolledCategoryCount >= Number(maxCategories)) {
    return {
      allowed: false,
      reason: 'category_limit_exceeded',
      message: `Your ${entitlement.planSlug} plan allows access to ${maxCategories} category(ies). Please upgrade to unlock more categories.`,
      statusCode: 403,
      upgradeRequired: true,
      limit: maxCategories,
    };
  }

  const limit = entitlement.maxCoursesTotal;
  const isUnlimited = limit === null || limit === 'Infinity' || limit === Infinity;

  if (!isUnlimited && currentEnrollments >= Number(limit)) {
    return {
      allowed: false,
      reason: 'limit_exceeded',
      message: `Your ${entitlement.planSlug} plan allows ${limit} course(s). Please upgrade to enroll in more courses.`,
      statusCode: 403,
      upgradeRequired: true,
      limit,
    };
  }

  const perCategoryLimit = entitlement.perCategoryCourseLimit;
  const perCategoryUnlimited = perCategoryLimit === null || perCategoryLimit === 'Infinity' || perCategoryLimit === Infinity;
  if (!perCategoryUnlimited && enrollmentsInSameCategory >= Number(perCategoryLimit)) {
    return {
      allowed: false,
      reason: 'per_category_limit_exceeded',
      message: `Your ${entitlement.planSlug} plan allows ${perCategoryLimit} course(s) in ${normalizedCategory} category.`,
      statusCode: 403,
      upgradeRequired: true,
      limit: perCategoryLimit,
    };
  }

  return {
    allowed: true,
    reason: 'allowed',
    entitlement,
  };
};

export const evaluateCommunityAccess = async (userId) => {
  const entitlement = await getUserEntitlementContext(userId);

  if (!entitlement) {
    return { hasAccess: false, reason: 'user_not_found' };
  }

  if (entitlement.source === 'dynamic') {
    return {
      hasAccess: !!entitlement.communityAccess,
      reason: entitlement.communityAccess ? 'allowed' : 'plan_restriction',
      plan: entitlement.planSlug,
      status: entitlement.user.subscriptionStatus,
    };
  }

  return {
    hasAccess: false,
    reason: 'no_active_membership',
    plan: 'free',
    status: entitlement.user.subscriptionStatus,
  };
};
