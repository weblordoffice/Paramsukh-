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
  features: { text: string; included: boolean }[];
  courseSelection?: {
    enabled: boolean;
    maxSelectableCourses: number;
    eligibleCoursesMode: string;
    eligibleCourseIds: string[];
    eligibleCategories: string[];
  };
}

export interface EligibleCoursePreview {
  _id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  color?: string;
  duration?: string;
  category?: string;
  totalVideos?: number;
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
  const color = defaultVisual.color;

  return {
    id: slug,
    slug,
    parentSlug: slug,
    variantSlug: null,
    rawId: plan?._id ? String(plan._id) : undefined,
    name: plan?.title || toTitle(slug),
    emoji: defaultVisual.emoji,
    price: Number(plan?.pricing?.oneTime?.amount || 0),
    color,
    gradient: defaultVisual.gradient,
    tagline: plan?.shortDescription || (plan?.isLifetime ? 'Lifetime access' : `${Number(plan?.validityDays || 365)} days validity`),
    features: buildPlanFeatures(plan),
    courseSelection: plan?.access?.courseSelection?.enabled
      ? {
          enabled: true,
          maxSelectableCourses: plan.access.courseSelection.maxSelectableCourses || 3,
          eligibleCoursesMode: plan.access.courseSelection.eligibleCoursesMode || 'all_published',
          eligibleCourseIds: (plan.access.courseSelection.eligibleCourseIds || []).map((id: any) => String(id)),
          eligibleCategories: plan.access.courseSelection.eligibleCategories || [],
        }
      : undefined,
  };
};

export const fetchPublicMembershipPlans = async (): Promise<UIMembershipPlan[]> => {
  try {
    const response = await apiClient.get('/membership-plans/public');
    const plans = response.data?.data;

    if (!Array.isArray(plans) || plans.length === 0) {
      return [];
    }

    const mapped = plans
      .map((plan: any) => mapParentPlan(plan))
      .filter((plan) => !!plan.id);

    return mapped;
  } catch {
    return [];
  }
};

export const fetchEligibleCoursePreviews = async (
  planSlug: string
): Promise<EligibleCoursePreview[]> => {
  if (!planSlug) return [];

  try {
    const response = await apiClient.get(`/membership-plans/${planSlug}/eligible-courses`);
    return (response.data?.courses || []).map(mapCoursePreview);
  } catch {
    return [];
  }
};

const mapCoursePreview = (course: any): EligibleCoursePreview => ({
  _id: course._id,
  title: course.title,
  description: course.description,
  thumbnailUrl: course.thumbnailUrl,
  color: course.color,
  duration: course.duration,
  category: course.category,
  totalVideos: course.totalVideos,
});
