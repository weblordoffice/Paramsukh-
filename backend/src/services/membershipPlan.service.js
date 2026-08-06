import mongoose from 'mongoose';
import { MembershipPlan } from '../models/membershipPlan.models.js';

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
