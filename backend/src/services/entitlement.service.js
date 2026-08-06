import { User } from '../models/user.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import { resolveMembershipPlanInheritanceFromPlan, resolveMembershipPlanInheritanceBySlug, normalizePlanSlug } from './membershipPlan.service.js';

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
    $or: [
      { endDate: { $gte: new Date() } },
      { endDate: null },
    ],
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
      membershipId: String(activeMembership._id),
      courseSelectionEnabled: plan.access?.courseSelection?.enabled || false,
      membership: activeMembership,
    };
  }

  // Fallback: some legacy users may have `subscriptionPlan` on the User
  // document but no `UserMembership` entry. Use that as a best-effort
  // entitlement source so active plan holders are recognized.
  if (!activeMembership && user?.subscriptionPlan && user?.subscriptionStatus === 'active') {
    const userPlanSlug = normalizePlanSlug(user.subscriptionPlan || '');
    // Ensure the subscription hasn't expired
    const isExpired = user.subscriptionEndDate && new Date(user.subscriptionEndDate) < new Date();
    if (userPlanSlug && userPlanSlug !== 'free' && !isExpired) {
      try {
        const inheritance = await resolveMembershipPlanInheritanceBySlug(userPlanSlug);
        const resolvedPlans = inheritance.plans.length > 0 ? inheritance.plans : [];
        const planSlugs = inheritance.planSlugs.length > 0 ? inheritance.planSlugs : [userPlanSlug];
        let communityAccess = false;

        resolvedPlans.forEach((resolved) => {
          if (resolved.access?.communityAccess) communityAccess = true;
        });

        return {
          source: 'fallback_user_field',
          user,
          planId: null,
          planSlug: userPlanSlug,
          planSlugs,
          accessMode: 'entitlement_only',
          communityAccess,
          isPaid: true,
          courseSelectionEnabled: false,
        };
      } catch (err) {
        // ignore and continue to default fallback below
      }
    }
  }

  return {
    source: 'none',
    user,
    planSlug: 'free',
    planSlugs: ['free'],
    accessMode: 'entitlement_only',
    communityAccess: false,
    isPaid: false,
    courseSelectionEnabled: false,
  };
};

export const evaluateCourseEnrollmentAccess = async ({
  userId,
  course,
  currentEnrollments: _currentEnrollments,
  distinctEnrolledCategoryCount: _distinctEnrolledCategoryCount = 0,
  isAlreadyUsingCourseCategory: _isAlreadyUsingCourseCategory = false,
  enrollmentsInSameCategory: _enrollmentsInSameCategory = 0,
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

  const isCourseFree = !course.includedInPlans || course.includedInPlans.length === 0;

  if (!isCourseFree && !entitlement.isPaid) {
    return {
      allowed: false,
      reason: 'plan_required',
      message: 'This course requires an active membership plan.',
      statusCode: 403,
      upgradeRequired: true,
    };
  }

  // course.includedInPlans may contain slugs (new) or ObjectIds (legacy from old admin UI)
  const isObjectId = (v) => /^[a-f\d]{24}$/i.test(String(v));
  const matchesPlanTag = isCourseFree || (course.includedInPlans || []).some((tag) => {
    const t = normalize(tag);
    if (isObjectId(t)) {
      return entitlement.planId && t === entitlement.planId.toLowerCase();
    }
    return (entitlement.planSlugs || [entitlement.planSlug]).map(normalize).includes(t);
  });

  if (entitlement.courseSelectionEnabled && !isCourseFree) {
    const selectedCourseIds = (entitlement.membership?.selectedCourseIds || []).map(String);
    if (!selectedCourseIds.includes(String(course._id))) {
      return {
        allowed: false,
        reason: 'requires_selection',
        message: 'Use your membership credits to select this course.',
        statusCode: 403,
        needsCourseSelection: true,
        membershipId: entitlement.membershipId,
        remainingCredits: entitlement.membership?.selectedCourseCredits || 0,
      };
    }
    return {
      allowed: true,
      reason: 'selected_via_credits',
      entitlement,
    };
  }

  if (!matchesPlanTag) {
    return {
      allowed: false,
      reason: 'course_not_included',
      message: `Your ${entitlement.planSlug} plan does not include this course.`,
      statusCode: 403,
      upgradeRequired: true,
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

  if (entitlement.source === 'dynamic' || entitlement.source === 'fallback_user_field') {
    return {
      hasAccess: entitlement.communityAccess === true,
      reason: entitlement.communityAccess ? 'allowed' : 'not_included',
      plan: entitlement.planSlug,
      status: entitlement.user.subscriptionStatus,
    };
  }

  // Free users / no plan — no community access
  return {
    hasAccess: false,
    reason: 'free_plan',
    plan: 'free',
    status: entitlement.user.subscriptionStatus,
    isFreeUser: true,
  };
};
