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
    let communityAccess = false;

    resolvedPlans.forEach((resolved) => {
      if (resolved.access?.communityAccess) {
        communityAccess = true;
      }
    });

    return {
      source: 'dynamic',
      user,
      planId: String(plan._id),
      planSlug: normalize(plan.slug),
      planSlugs,
      accessMode: plan.access?.accessMode || 'entitlement_only',
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

  // course.includedInPlans may contain slugs (new) or ObjectIds (legacy from old admin UI)
  // We handle both: slugs are compared to planSlugs, ObjectIds are compared to the active plan's _id
  const isObjectId = (v) => /^[a-f\d]{24}$/i.test(String(v));
  const matchesPlanTag = (course.includedInPlans || []).some((tag) => {
    const t = normalize(tag);
    if (isObjectId(t)) {
      // legacy ObjectId stored in includedInPlans — compare against active plan _id
      return entitlement.planId && t === entitlement.planId.toLowerCase();
    }
    // new format — compare slug
    return (entitlement.planSlugs || [entitlement.planSlug]).map(normalize).includes(t);
  });

  if (!matchesPlanTag) {
    return {
      allowed: false,
      reason: 'course_not_included',
      message: `Your ${entitlement.planSlug} plan does not include this course.`,
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
