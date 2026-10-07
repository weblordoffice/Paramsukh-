import mongoose from 'mongoose';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { UserMembership } from '../models/userMembership.models.js';

export const normalizePlanSlug = (plan) => String(plan || '').trim().toLowerCase();

const parseSelectionInput = (planInput) => {
  if (planInput && typeof planInput === 'object' && !Array.isArray(planInput)) {
    const inputPlan = normalizePlanSlug(
      planInput.plan
      || planInput.planSlug
      || planInput.slug
      || ''
    );
    return inputPlan;
  }

  return normalizePlanSlug(planInput);
};

const resolvePlanInheritance = async (rootPlan) => {
  if (!rootPlan?._id) {
    return { plans: [], planIds: [], planSlugs: [] };
  }

  const planIds = new Set([String(rootPlan._id)]);
  const plansById = new Map([[String(rootPlan._id), rootPlan]]);
  const queue = [rootPlan];

  while (queue.length > 0) {
    const current = queue.shift();
    const inheritedIds = (current?.access?.inheritedPlanIds || [])
      .filter(id => id && mongoose.Types.ObjectId.isValid(String(id)));

    for (const inheritedId of inheritedIds) {
      const idStr = String(inheritedId);
      if (planIds.has(idStr)) {
        continue;
      }
      planIds.add(idStr);
      const parentPlan = await MembershipPlan.findById(inheritedId).lean();
      if (parentPlan) {
        plansById.set(idStr, parentPlan);
        queue.push(parentPlan);
      }
    }
  }

  const plans = Array.from(plansById.values());
  const planSlugs = plans.map((plan) => normalizePlanSlug(plan.slug)).filter(Boolean);

  return { plans, planIds: Array.from(planIds), planSlugs };
};

export const resolveMembershipPlanInheritanceFromPlan = async (plan) => {
  if (!plan) {
    return { plans: [], planIds: [], planSlugs: [] };
  }
  return resolvePlanInheritance(plan);
};

export const resolveMembershipPlanInheritanceBySlug = async (planSlug) => {
  const slug = normalizePlanSlug(planSlug);
  if (!slug || slug === 'free') {
    return { plans: [], planIds: [], planSlugs: [] };
  }

  const plan = await MembershipPlan.findOne({ slug }).lean();
  if (!plan) {
    return { plans: [], planIds: [], planSlugs: [] };
  }

  return resolvePlanInheritance(plan);
};

export const getPublishedMembershipPlan = async (planSlug) => {
  const slug = normalizePlanSlug(planSlug);
  if (!slug) {
    return null;
  }

  return MembershipPlan.findOne({ slug, status: 'published' }).lean();
};

export const resolveMembershipPlanChargeAmount = async (planSlug) => {
  const slug = parseSelectionInput(planSlug);

  if (!slug) {
    return { isValid: false, slug: '', amount: null, source: 'invalid' };
  }

  const plan = await getPublishedMembershipPlan(slug);

  if (plan) {
    const amount = Number(plan?.pricing?.oneTime?.amount || 0);
    const currency = plan?.pricing?.oneTime?.currency || 'INR';
    const validityDays = plan.isLifetime ? null : Number(plan?.validityDays ?? 365);

    return {
      isValid: true,
      source: 'dynamic',
      slug,
      parentSlug: slug,
      selectionKey: slug,
      amount,
      currency,
      validityDays,
      isLifetime: !!plan.isLifetime,
      displayTitle: plan.title,
      plan,
    };
  }

  return {
    isValid: false,
    slug,
    parentSlug: slug,
    selectionKey: slug,
    amount: null,
    currency: 'INR',
    validityDays: null,
    plan: null,
    source: 'invalid',
  };
};

export const isKnownMembershipPlan = async (planSlug) => {
  const result = await resolveMembershipPlanChargeAmount(planSlug);
  return result.isValid;
};

/**
 * Resolve the plan slugs a user currently owns (from active memberships) and the
 * full inheritance closure of each owned plan.
 *
 * Returns:
 *  - directSlugs: plan slugs the user directly holds
 *  - closureSlugs: union of directSlugs and everything those plans inherit
 *  - closureBySlug: Map<ownedSlug, Set<slug>> for per-plan coverage attribution
 */
export const resolveUserOwnedPlans = async (userId) => {
  const directSlugs = new Set();
  const closureBySlug = new Map();

  if (!userId) {
    return { directSlugs: [], closureSlugs: [], closureBySlug };
  }

  const now = new Date();
  const memberships = await UserMembership.find({
    userId,
    status: 'active',
    $or: [
      { endDate: { $gte: now } },
      { endDate: null },
      { endDate: { $exists: false } },
    ],
  })
    .select('planId planSnapshot.slug')
    .lean();

  for (const membership of memberships) {
    let slug = normalizePlanSlug(membership?.planSnapshot?.slug || '');
    if (!slug && membership.planId) {
      try {
        const plan = await MembershipPlan.findById(membership.planId).select('slug').lean();
        slug = normalizePlanSlug(plan?.slug || '');
      } catch {
        // ignore
      }
    }
    if (slug && slug !== 'free') {
      directSlugs.add(slug);
    }
  }

  for (const slug of directSlugs) {
    const closure = new Set([slug]);
    try {
      const inheritance = await resolveMembershipPlanInheritanceBySlug(slug);
      (inheritance.planSlugs || []).forEach((s) => {
        const normalized = normalizePlanSlug(s);
        if (normalized) closure.add(normalized);
      });
    } catch {
      // ignore
    }
    closureBySlug.set(slug, closure);
  }

  const closureSlugs = new Set();
  closureBySlug.forEach((set) => set.forEach((slug) => closureSlugs.add(slug)));

  return {
    directSlugs: Array.from(directSlugs),
    closureSlugs: Array.from(closureSlugs),
    closureBySlug,
  };
};

/**
 * Annotate published plans with per-user coverage flags.
 *
 * For each plan:
 *  - isOwned:   user directly holds this plan
 *  - isCovered: plan is fully included by a plan the user owns (not owned itself)
 *  - coveredBy: slugs of the user's owned plans that cover it
 *  - isUpgrade: plan is a higher tier that includes something the user owns
 */
export const resolvePlanCoverage = async (userId, plans = []) => {
  const { directSlugs, closureSlugs, closureBySlug } = await resolveUserOwnedPlans(userId);
  const direct = new Set(directSlugs);
  const closure = new Set(closureSlugs);

  const results = [];
  for (const plan of plans) {
    const slug = normalizePlanSlug(plan?.slug);
    if (!slug) continue;

    const isOwned = direct.has(slug);
    const isCovered = !isOwned && closure.has(slug);

    let coveredBy = [];
    if (isCovered) {
      for (const [ownedSlug, set] of closureBySlug.entries()) {
        if (set.has(slug)) coveredBy.push(ownedSlug);
      }
    }

    let isUpgrade = false;
    if (!isOwned && !isCovered) {
      try {
        const inheritance = await resolveMembershipPlanInheritanceFromPlan(plan);
        const planClosure = new Set((inheritance.planSlugs || []).map((s) => normalizePlanSlug(s)));
        for (const ownedSlug of directSlugs) {
          if (planClosure.has(ownedSlug)) {
            isUpgrade = true;
            break;
          }
        }
      } catch {
        // ignore
      }
    }

    results.push({ slug, isOwned, isCovered, isUpgrade, coveredBy });
  }

  return results;
};

/**
 * Returns whether a user can purchase the given plan. Plans already included by
 * a plan the user holds are blocked. Holding the exact plan is allowed (renewal).
 */
export const isPlanCoveredByUser = async (userId, planSlug) => {
  const slug = normalizePlanSlug(planSlug);
  if (!slug || slug === 'free') {
    return { covered: false, owned: false, coveredBy: [] };
  }

  const { directSlugs, closureBySlug } = await resolveUserOwnedPlans(userId);
  const direct = new Set(directSlugs);

  // Re-purchasing the same plan is treated as a renewal, not a duplicate.
  if (direct.has(slug)) {
    return { covered: false, owned: true, coveredBy: [slug] };
  }

  const coveredBy = [];
  for (const [ownedSlug, set] of closureBySlug.entries()) {
    if (set.has(slug)) coveredBy.push(ownedSlug);
  }

  return { covered: coveredBy.length > 0, owned: false, coveredBy };
};

/**
 * Validate a plan's relationship configuration before save.
 * - standalone plans cannot include other plans
 * - tiered plans may only include other tiered plans, with no cycles/self-reference
 */
export const validatePlanRelationships = async ({ planKind, inheritedPlanIds = [], planId = null }) => {
  const kind = planKind === 'tiered' ? 'tiered' : 'standalone';
  const uniqueIds = [...new Set(
    (Array.isArray(inheritedPlanIds) ? inheritedPlanIds : [])
      .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
      .map(String)
  )];

  if (kind === 'standalone') {
    if (uniqueIds.length > 0) {
      return { valid: false, message: 'A standalone plan cannot include other plans.' };
    }
    return { valid: true, inheritedPlanIds: [] };
  }

  if (uniqueIds.length === 0) {
    return { valid: true, inheritedPlanIds: [] };
  }

  if (planId && uniqueIds.includes(String(planId))) {
    return { valid: false, message: 'A plan cannot include itself.' };
  }

  const included = await MembershipPlan.find({ _id: { $in: uniqueIds } })
    .select('_id slug planKind access.inheritedPlanIds')
    .lean();

  if (included.length !== uniqueIds.length) {
    const foundIds = new Set(included.map((p) => String(p._id)));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    return { valid: false, message: `Included plan not found: ${missing.join(', ')}` };
  }

  const nonTiered = included.filter((p) => (p.planKind || 'standalone') !== 'tiered');
  if (nonTiered.length > 0) {
    return {
      valid: false,
      message: `Only tiered plans can be included. Not tiered: ${nonTiered.map((p) => p.slug).join(', ')}`,
    };
  }

  if (planId) {
    const targetId = String(planId);
    const visited = new Set();
    const stack = [...uniqueIds];

    while (stack.length > 0) {
      const currentId = stack.pop();
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);

      let current = included.find((p) => String(p._id) === currentId);
      if (!current) {
        current = await MembershipPlan.findById(currentId)
          .select('access.inheritedPlanIds')
          .lean();
      }

      const parents = (current?.access?.inheritedPlanIds || []).map((id) => String(id));
      if (parents.includes(targetId)) {
        return { valid: false, message: 'Circular plan inheritance detected.' };
      }
      parents.forEach((id) => {
        if (!visited.has(id)) stack.push(id);
      });
    }
  }

  return { valid: true, inheritedPlanIds: uniqueIds };
};

export const reconcileUserSubscriptionPlanIntegrity = async (user, { save = true } = {}) => {
  if (!user) {
    return { reconciled: false, reason: 'no_user' };
  }

  const currentPlan = normalizePlanSlug(user.subscriptionPlan || 'free');
  if (!currentPlan || currentPlan === 'free') {
    return { reconciled: false, reason: 'free_or_empty' };
  }

  const planExists = await MembershipPlan.exists({ slug: currentPlan });
  if (planExists) {
    return { reconciled: false, reason: 'plan_exists' };
  }

  user.subscriptionPlan = 'free';
  user.subscriptionStatus = 'inactive';
  user.subscriptionStartDate = null;
  user.subscriptionEndDate = null;
  user.trialEndsAt = null;

  if (save && typeof user.save === 'function') {
    await user.save();
  }

  return {
    reconciled: true,
    previousPlan: currentPlan,
    newPlan: 'free',
  };
};
