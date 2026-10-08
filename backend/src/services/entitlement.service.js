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

  const activeMemberships = await UserMembership.find({
    userId,
    status: 'active',
    $or: [
      { endDate: { $gte: new Date() } },
      { endDate: null },
      { endDate: { $exists: false } },
    ],
  })
    .populate('planId')
    .sort({ endDate: -1 })
    .lean();

  if (activeMemberships.length > 0) {
    const allPlanSlugs = [];
    const allPlanIds = [];
    const entitlementPlanSlugs = [];
    const selectionPlanSlugs = [];
    const selectedCourseIdSet = new Set();
    let communityAccess = false;
    let isPaid = false;
    let courseSelectionEnabled = false;
    const allMembershipIds = [];

    for (const mem of activeMemberships) {
      if (!mem.planId) continue;
      const plan = mem.planId;
      const slug = normalize(plan.slug);
      allPlanSlugs.push(slug);
      allPlanIds.push(String(plan._id));
      allMembershipIds.push(String(mem._id));
      if (plan.access?.communityAccess) communityAccess = true;
      if (slug !== 'free') isPaid = true;
      if (plan.access?.courseSelection?.enabled) {
        courseSelectionEnabled = true;
        selectionPlanSlugs.push(slug);
      } else {
        entitlementPlanSlugs.push(slug);
      }
      (mem.selectedCourseIds || []).forEach((id) => selectedCourseIdSet.add(String(id)));

      // Inherited (lower-tier) plans are granted as entitlements: buying a higher
      // plan unlocks all courses of the plans it includes. The cap applies only
      // to the bought plan's OWN courses, not to inherited ones.
      try {
        const inheritance = await resolveMembershipPlanInheritanceFromPlan(plan);
        for (const inherited of inheritance.plans || []) {
          if (String(inherited._id) === String(plan._id)) continue;
          const inheritedSlug = normalize(inherited.slug);
          if (!inheritedSlug || inheritedSlug === 'free') continue;
          allPlanSlugs.push(inheritedSlug);
          allPlanIds.push(String(inherited._id));
          entitlementPlanSlugs.push(inheritedSlug);
          if (inherited.access?.communityAccess) communityAccess = true;
        }
      } catch {
        // ignore inheritance resolution errors
      }
    }

    const primary = activeMemberships[0];
    const primaryPlan = primary.planId;

    return {
      source: 'dynamic',
      user,
      planId: String(primaryPlan._id),
      planSlug: normalize(primaryPlan.slug),
      planSlugs: [...new Set(allPlanSlugs)],
      planIds: [...new Set(allPlanIds)],
      // Plans that grant courses directly (no credit selection required)
      entitlementPlanSlugs: [...new Set(entitlementPlanSlugs)],
      // Plans that require the user to spend credits to unlock courses
      selectionPlanSlugs: [...new Set(selectionPlanSlugs)],
      // Union of every course unlocked with credits across all active memberships
      selectedCourseIds: [...selectedCourseIdSet],
      accessMode: primaryPlan.access?.accessMode || 'entitlement_only',
      communityAccess,
      isPaid,
      membershipId: String(primary._id),
      courseSelectionEnabled,
      membership: primary,
      allMemberships: activeMemberships,
    };
  }

  // Fallback: some legacy users may have `subscriptionPlan` on the User
  // document but no `UserMembership` entry. Use that as a best-effort
  // entitlement source so active plan holders are recognized.
  if (activeMemberships.length === 0 && user?.subscriptionPlan && user?.subscriptionStatus === 'active') {
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
          planIds: [],
          entitlementPlanSlugs: planSlugs,
          selectionPlanSlugs: [],
          selectedCourseIds: [],
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
    planIds: [],
    entitlementPlanSlugs: [],
    selectionPlanSlugs: [],
    selectedCourseIds: [],
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
  const includedTags = course.includedInPlans || [];

  const matchSlugs = (slugs) => includedTags.some((tag) => {
    const t = normalize(tag);
    if (isObjectId(t)) return false;
    return (slugs || []).map(normalize).includes(t);
  });

  const matchLegacyPlanIds = () => {
    const planIds = (entitlement.planIds || []).map((id) => String(id).toLowerCase());
    return includedTags.some((tag) => {
      const t = normalize(tag);
      return isObjectId(t) && planIds.includes(t);
    });
  };

  // 1. Directly granted by an entitlement (non-selection) plan the user holds.
  //    A course is unlocked as soon as ANY held plan includes it this way.
  const entitlementSlugs = entitlement.entitlementPlanSlugs || [];
  if (isCourseFree || matchSlugs(entitlementSlugs) || matchLegacyPlanIds()) {
    return {
      allowed: true,
      reason: 'allowed',
      entitlement,
    };
  }

  // 2. Unlocked with credits in ANY of the user's active memberships.
  const selectedCourseIds = (entitlement.selectedCourseIds || []).map(String);
  if (selectedCourseIds.includes(String(course._id))) {
    return {
      allowed: true,
      reason: 'selected_via_credits',
      entitlement,
    };
  }

  // 3. Part of a credit-selection plan the user holds → needs a credit.
  const selectionSlugs = (entitlement.selectionPlanSlugs || []).map(normalize);
  if (entitlement.courseSelectionEnabled && matchSlugs(selectionSlugs)) {
    const candidate = (entitlement.allMemberships || []).find((m) => {
      const slug = normalize(m.planId?.slug);
      return m.planId?.access?.courseSelection?.enabled
        && selectionSlugs.includes(slug)
        && (m.selectedCourseCredits || 0) > 0;
    }) || entitlement.membership;

    return {
      allowed: false,
      reason: 'requires_selection',
      message: 'Use your membership credits to select this course.',
      statusCode: 403,
      needsCourseSelection: true,
      membershipId: candidate ? String(candidate._id) : entitlement.membershipId,
      remainingCredits: candidate?.selectedCourseCredits || 0,
    };
  }

  return {
    allowed: false,
    reason: 'course_not_included',
    message: `Your ${entitlement.planSlug} plan does not include this course.`,
    statusCode: 403,
    upgradeRequired: true,
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
