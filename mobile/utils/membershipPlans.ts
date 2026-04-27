import apiClient from './apiClient';

export interface UIMembershipPlan {
  id: string;
  slug: string;
  parentSlug: string;
  variantSlug?: string | null;
  rawId?: string;
  name: string;
  emoji: string;
  price: number;
  color: string;
  gradient: string[];
  tagline: string;
  popular: boolean;
  features: { text: string; included: boolean }[];
}

interface FetchPublicMembershipPlansOptions {
  includeVariants?: boolean;
}

const defaultVisual = { emoji: '✨', color: '#64748B', gradient: ['#E2E8F0', '#CBD5E1'] };

const toTitle = (text: string) => {
  const value = String(text || '');
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
};

const buildPlanFeatures = (plan: any, variant: any = null) => {
  const variantBenefits = Array.isArray(variant?.benefits) ? variant.benefits : [];
  const apiBenefits = variantBenefits.length > 0
    ? variantBenefits
    : (Array.isArray(plan?.benefits) ? plan.benefits : []);
  if (apiBenefits.length > 0) {
    return apiBenefits.map((benefit: any) => ({
      text: String(benefit?.text || '').trim(),
      included: benefit?.included !== false,
    })).filter((item: { text: string }) => !!item.text);
  }

  const categories = Array.isArray(plan?.access?.includedCategories) ? plan.access.includedCategories : [];
  const subcategories = Array.isArray(plan?.access?.includedSubcategories) ? plan.access.includedSubcategories : [];
  const categoryText = categories.length > 0
    ? `${categories.length} configured categories`
    : 'Category access defined by admin';
  const subcategoryText = subcategories.length > 0
    ? `${subcategories.length} configured subcategories`
    : 'Subcategory access defined by admin';

  return [
    { text: categoryText, included: true },
    { text: subcategoryText, included: true },
    { text: plan?.access?.communityAccess ? 'Community access included' : 'Community access', included: !!plan?.access?.communityAccess },
    { text: plan?.access?.counselingAccess ? 'Counseling support included' : 'Counseling support', included: !!plan?.access?.counselingAccess },
    { text: plan?.access?.eventAccess ? 'Event access included' : 'Event access', included: !!plan?.access?.eventAccess },
  ];
};

const mapParentPlan = (plan: any): UIMembershipPlan => {
  const slug = String(plan?.slug || '').toLowerCase();
  const metadataColor = plan?.metadata?.badgeColor;
  const color = metadataColor || defaultVisual.color;

  return {
    id: slug,
    slug,
    parentSlug: slug,
    variantSlug: null,
    rawId: plan?._id ? String(plan._id) : undefined,
    name: plan?.title || toTitle(slug),
    emoji: plan?.metadata?.icon || defaultVisual.emoji,
    price: Number(plan?.pricing?.oneTime?.amount || 0),
    color,
    gradient: defaultVisual.gradient,
    tagline: plan?.shortDescription || `${Number(plan?.validityDays || 365)} days validity`,
    popular: !!plan?.metadata?.popular,
    features: buildPlanFeatures(plan),
  };
};

const mapVariantPlan = (plan: any, variant: any): UIMembershipPlan | null => {
  const parentSlug = String(plan?.slug || '').toLowerCase();
  const variantSlug = String(variant?.slug || '').toLowerCase();
  if (!parentSlug || !variantSlug) {
    return null;
  }

  const useCustomPricingAndValidity = !!variant?.useCustomPricingAndValidity;
  const parentAmount = Number(plan?.pricing?.oneTime?.amount || 0);
  const parentValidityDays = Number(plan?.validityDays || 365);
  const variantAmount = Number(variant?.customPricing?.amount);
  const variantValidityDays = Number(variant?.customValidityDays);

  const price = useCustomPricingAndValidity && Number.isFinite(variantAmount)
    ? variantAmount
    : parentAmount;
  const validityDays = useCustomPricingAndValidity && Number.isFinite(variantValidityDays) && variantValidityDays > 0
    ? variantValidityDays
    : parentValidityDays;

  const metadataColor = variant?.metadata?.badgeColor || plan?.metadata?.badgeColor;
  const color = metadataColor || defaultVisual.color;

  return {
    id: `${parentSlug}::${variantSlug}`,
    slug: `${parentSlug}::${variantSlug}`,
    parentSlug,
    variantSlug,
    rawId: variant?._id ? String(variant._id) : undefined,
    name: `${plan?.title || toTitle(parentSlug)} - ${variant?.title || toTitle(variantSlug)}`,
    emoji: variant?.metadata?.icon || plan?.metadata?.icon || defaultVisual.emoji,
    price,
    color,
    gradient: defaultVisual.gradient,
    tagline: variant?.shortDescription || `${validityDays} days validity`,
    popular: variant?.metadata?.popular === true || !!plan?.metadata?.popular,
    features: buildPlanFeatures(plan, variant),
  };
};

export const fetchPublicMembershipPlans = async (
  options: FetchPublicMembershipPlansOptions = {}
): Promise<UIMembershipPlan[]> => {
  try {
    const response = await apiClient.get('/membership-plans/public');
    const plans = response.data?.data;

    if (!Array.isArray(plans) || plans.length === 0) {
      return [];
    }

    const includeVariants = options.includeVariants === true;
    const mapped: UIMembershipPlan[] = [];

    plans.forEach((plan: any) => {
      const parent = mapParentPlan(plan);
      if (parent.id) {
        mapped.push(parent);
      }

      if (!includeVariants || !plan?.planVariantsEnabled || !Array.isArray(plan?.planVariants)) {
        return;
      }

      plan.planVariants
        .filter((variant: any) => variant && variant.isActive !== false)
        .sort((a: any, b: any) => Number(a?.displayOrder || 0) - Number(b?.displayOrder || 0))
        .forEach((variant: any) => {
          const mappedVariant = mapVariantPlan(plan, variant);
          if (mappedVariant?.id) {
            mapped.push(mappedVariant);
          }
        });
    });

    return mapped.filter((plan) => !!plan.id);
  } catch {
    return [];
  }
};
