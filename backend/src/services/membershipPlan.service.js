import { MembershipPlan } from '../models/membershipPlan.models.js';

export const normalizePlanSlug = (plan) => String(plan || '').trim().toLowerCase();

const resolvePlanInheritance = async (rootPlan) => {
  if (!rootPlan?._id) {
    return { plans: [], planIds: [], planSlugs: [] };
  }

  const planIds = new Set([String(rootPlan._id)]);
  const plansById = new Map([[String(rootPlan._id), rootPlan]]);
  const queue = [rootPlan];

  while (queue.length > 0) {
    const current = queue.shift();
    const inheritedIds = current?.access?.inheritedPlanIds || [];

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
  const slug = normalizePlanSlug(planSlug);
  if (!slug) {
    return { isValid: false, slug: '', amount: null, source: 'invalid' };
  }

  const plan = await getPublishedMembershipPlan(slug);
  if (plan) {
    return {
      isValid: true,
      slug,
      amount: Number(plan.pricing?.oneTime?.amount || 0),
      currency: plan.pricing?.oneTime?.currency || 'INR',
      plan,
      source: 'dynamic',
    };
  }

  return {
    isValid: false,
    slug,
    amount: null,
    currency: 'INR',
    plan: null,
    source: 'invalid',
  };
};

export const isKnownMembershipPlan = async (planSlug) => {
  const result = await resolveMembershipPlanChargeAmount(planSlug);
  return result.isValid;
};
