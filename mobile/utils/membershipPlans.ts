import apiClient from './apiClient';

export interface UIMembershipPlan {
  id: string;
  name: string;
  emoji: string;
  price: number;
  color: string;
  gradient: string[];
  tagline: string;
  popular: boolean;
  features: { text: string; included: boolean }[];
}

const defaultVisual = { emoji: '✨', color: '#64748B', gradient: ['#E2E8F0', '#CBD5E1'] };

const toTitle = (text: string) => {
  const value = String(text || '');
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
};

const buildPlanFeatures = (plan: any) => {
  const apiBenefits = Array.isArray(plan?.benefits) ? plan.benefits : [];
  if (apiBenefits.length > 0) {
    return apiBenefits.map((benefit: any) => ({
      text: String(benefit?.text || '').trim(),
      included: benefit?.included !== false,
    })).filter((item: { text: string }) => !!item.text);
  }

  const categories = Array.isArray(plan?.access?.includedCategories) ? plan.access.includedCategories : [];
  const categoryText = categories.length > 0
    ? `${categories.length} configured categories`
    : 'Category access defined by admin';

  return [
    { text: categoryText, included: true },
    { text: plan?.access?.communityAccess ? 'Community access included' : 'Community access', included: !!plan?.access?.communityAccess },
    { text: plan?.access?.counselingAccess ? 'Counseling support included' : 'Counseling support', included: !!plan?.access?.counselingAccess },
    { text: plan?.access?.eventAccess ? 'Event access included' : 'Event access', included: !!plan?.access?.eventAccess },
  ];
};

export const fetchPublicMembershipPlans = async (): Promise<UIMembershipPlan[]> => {
  try {
    const response = await apiClient.get('/membership-plans/public');
    const plans = response.data?.data;

    if (!Array.isArray(plans) || plans.length === 0) {
      return [];
    }

    const mapped = plans.map((plan: any): UIMembershipPlan => {
      const slug = String(plan?.slug || '').toLowerCase();

      const metadataColor = plan?.metadata?.badgeColor;
      const color = metadataColor || defaultVisual.color;

      return {
        id: slug,
        name: plan?.title || toTitle(slug),
        emoji: plan?.metadata?.icon || defaultVisual.emoji,
        price: Number(plan?.pricing?.oneTime?.amount || 0),
        color,
        gradient: defaultVisual.gradient,
        tagline: plan?.shortDescription || `${Number(plan?.validityDays || 365)} days validity`,
        popular: !!plan?.metadata?.popular,
        features: buildPlanFeatures(plan),
      };
    });

    return mapped.filter((plan) => !!plan.id);
  } catch {
    return [];
  }
};
