import { MembershipPlan } from '../models/membershipPlan.models.js';

export const normalizePlanSlug = (plan) => String(plan || '').trim().toLowerCase();
export const normalizePlanVariantSlug = (variant) => String(variant || '').trim().toLowerCase();

export const buildMembershipSelectionKey = (planSlug, variantSlug = null) => {
  const normalizedPlan = normalizePlanSlug(planSlug);
  const normalizedVariant = normalizePlanVariantSlug(variantSlug);
  if (!normalizedPlan) {
    return '';
  }
  return normalizedVariant ? `${normalizedPlan}::${normalizedVariant}` : normalizedPlan;
};

const parseSelectionInput = (planInput, variantInput = null) => {
  if (planInput && typeof planInput === 'object' && !Array.isArray(planInput)) {
    const inputPlan = normalizePlanSlug(
      planInput.plan
      || planInput.planSlug
      || planInput.slug
      || ''
    );
    const inputVariant = normalizePlanVariantSlug(
      planInput.variantSlug
      || planInput.planVariant
      || planInput.variant
      || variantInput
      || ''
    );

    return { planSlug: inputPlan, variantSlug: inputVariant };
  }

  const rawPlan = normalizePlanSlug(planInput);
  const rawVariant = normalizePlanVariantSlug(variantInput);

  if (rawPlan.includes('::') && !rawVariant) {
    const [planSlug, variantSlug] = rawPlan.split('::');
    return {
      planSlug: normalizePlanSlug(planSlug),
      variantSlug: normalizePlanVariantSlug(variantSlug),
    };
  }

  return { planSlug: rawPlan, variantSlug: rawVariant };
};

const getActiveVariants = (plan) => {
  if (!plan?.planVariantsEnabled) {
    return [];
  }

  const variants = Array.isArray(plan.planVariants) ? plan.planVariants : [];
  return variants.filter((variant) => {
    if (!variant) {
      return false;
    }
    const slug = normalizePlanVariantSlug(variant.slug);
    return Boolean(slug) && variant.isActive !== false;
  });
};

const resolveSelectionFromPlan = (plan, requestedVariantSlug = '') => {
  const parentSlug = normalizePlanSlug(plan?.slug);
  if (!parentSlug) {
    return { isValid: false, source: 'invalid', slug: '' };
  }

  const variantSlug = normalizePlanVariantSlug(requestedVariantSlug);
  const activeVariants = getActiveVariants(plan);
  const selectedVariant = variantSlug
    ? activeVariants.find((variant) => normalizePlanVariantSlug(variant.slug) === variantSlug) || null
    : null;

  if (variantSlug && !selectedVariant) {
    return {
      isValid: false,
      source: plan?.planVariantsEnabled ? 'variant_not_found' : 'variant_disabled',
      slug: parentSlug,
      parentSlug,
      variantSlug,
      selectionKey: buildMembershipSelectionKey(parentSlug, variantSlug),
      amount: null,
      currency: 'INR',
      validityDays: null,
      plan,
      variant: null,
    };
  }

  const useCustomPricingAndValidity = Boolean(selectedVariant?.useCustomPricingAndValidity);

  const parentAmount = Number(plan?.pricing?.oneTime?.amount || 0);
  const parentCurrency = plan?.pricing?.oneTime?.currency || 'INR';
  const parentValidityDays = Number(plan?.validityDays || 365);

  const customAmount = Number(selectedVariant?.customPricing?.amount);
  const customCurrency = selectedVariant?.customPricing?.currency || parentCurrency;
  const customValidityDays = Number(selectedVariant?.customValidityDays);

  const effectiveAmount = useCustomPricingAndValidity && Number.isFinite(customAmount)
    ? customAmount
    : parentAmount;
  const effectiveCurrency = useCustomPricingAndValidity
    ? customCurrency
    : parentCurrency;
  const effectiveValidityDays = useCustomPricingAndValidity && Number.isFinite(customValidityDays) && customValidityDays > 0
    ? customValidityDays
    : parentValidityDays;

  const resolvedVariantSlug = selectedVariant ? normalizePlanVariantSlug(selectedVariant.slug) : null;
  const selectionKey = buildMembershipSelectionKey(parentSlug, resolvedVariantSlug);
  const displayTitle = selectedVariant
    ? `${plan.title} - ${selectedVariant.title}`
    : plan.title;

  return {
    isValid: true,
    source: selectedVariant ? 'dynamic_variant' : 'dynamic',
    slug: parentSlug,
    parentSlug,
    variantSlug: resolvedVariantSlug,
    selectionKey,
    amount: effectiveAmount,
    currency: effectiveCurrency,
    validityDays: effectiveValidityDays,
    displayTitle,
    plan,
    variant: selectedVariant,
  };
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
  const parsed = parseSelectionInput(planSlug);
  const requestedPlanSlug = parsed.planSlug;
  const requestedVariantSlug = parsed.variantSlug;

  if (!requestedPlanSlug) {
    return { isValid: false, slug: '', amount: null, source: 'invalid' };
  }

  let plan = await getPublishedMembershipPlan(requestedPlanSlug);
  let variantSlug = requestedVariantSlug;

  if (!plan && requestedPlanSlug !== 'free' && !requestedVariantSlug) {
    const planWithVariant = await MembershipPlan.findOne({
      status: 'published',
      planVariantsEnabled: true,
      'planVariants.slug': requestedPlanSlug,
      'planVariants.isActive': true,
    }).lean();

    if (planWithVariant) {
      plan = planWithVariant;
      variantSlug = requestedPlanSlug;
    }
  }

  if (plan) {
    return resolveSelectionFromPlan(plan, variantSlug);
  }

  return {
    isValid: false,
    slug: requestedPlanSlug,
    parentSlug: requestedPlanSlug,
    variantSlug: variantSlug || null,
    selectionKey: buildMembershipSelectionKey(requestedPlanSlug, variantSlug),
    amount: null,
    currency: 'INR',
    validityDays: null,
    plan: null,
    variant: null,
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
    if (user.subscriptionPlanVariant) {
      const plan = await MembershipPlan.findOne({ slug: currentPlan }).select('planVariantsEnabled planVariants').lean();
      const variantSlug = normalizePlanVariantSlug(user.subscriptionPlanVariant);
      const hasVariant = Boolean(
        variantSlug
        && plan?.planVariantsEnabled
        && Array.isArray(plan?.planVariants)
        && plan.planVariants.some((variant) => normalizePlanVariantSlug(variant.slug) === variantSlug && variant.isActive !== false)
      );

      if (!hasVariant) {
        user.subscriptionPlanVariant = null;
        if (save && typeof user.save === 'function') {
          await user.save();
        }
        return { reconciled: true, reason: 'variant_reset', previousPlan: currentPlan, newPlan: currentPlan };
      }
    }

    return { reconciled: false, reason: 'plan_exists' };
  }

  user.subscriptionPlan = 'free';
  user.subscriptionPlanVariant = null;
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
