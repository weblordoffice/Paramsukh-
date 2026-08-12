import { MembershipPlan } from '../models/membershipPlan.models.js';
import { UserMembership } from '../models/userMembership.models.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

export const upsertActiveUserMembership = async ({
  userId,
  planSlug,
  planConfig = null,
  startDate,
  endDate,
  source = 'purchase',
  payment = null,
  metadata = {},
  selectedCourseIds = [],
}) => {
  const slug = normalize(planSlug);
  if (!userId || !slug || slug === 'free') {
    return null;
  }

  const plan = await MembershipPlan.findOne({ slug }).lean();
  if (!plan) {
    return null;
  }

  const snapshotAmount = Number(planConfig?.amount ?? plan.pricing?.oneTime?.amount ?? 0);
  const snapshotCurrency = planConfig?.currency || plan.pricing?.oneTime?.currency || 'INR';

  const planSnapshot = {
    title: planConfig?.displayTitle || plan.title,
    slug: plan.slug,
    pricing: {
      amount: snapshotAmount,
      currency: snapshotCurrency,
      type: 'one_time',
    },
  };

  const isLifetime = planConfig?.isLifetime || plan.isLifetime || false;
  const validityDays = Number(planConfig?.validityDays ?? plan.validityDays ?? 365);
  const courseIdsToStore = Array.isArray(selectedCourseIds) ? selectedCourseIds.filter(Boolean).map(String) : [];
  console.log(`[UpsertMembership] userId=${userId} planSlug=${slug} courseSelectionEnabled=${plan.access?.courseSelection?.enabled} maxSelectable=${plan.access?.courseSelection?.maxSelectableCourses} courseIdsToStore=${JSON.stringify(courseIdsToStore)}`);

  // Use sentinel far-future date for lifetime plans (schema requires endDate)
  const resolvedEndDate = endDate
    || (isLifetime ? new Date('2099-12-31T23:59:59.999Z')
    : new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000));

  const isPlanSwitch = plan.access?.courseSelection?.enabled;

  const setFields = {
    planId: plan._id,
    planSnapshot,
    status: 'active',
    source,
    startDate: startDate || new Date(),
    endDate: resolvedEndDate,
    autoRenew: false,
    courseSelectionEnabled: plan.access?.courseSelection?.enabled || false,
    metadata: { ...metadata },
    ...(payment ? {
      payment: {
        provider: payment.provider || 'manual',
        orderId: payment.orderId || null,
        paymentId: payment.paymentId || null,
        amount: Number(payment.amount || 0),
        currency: payment.currency || 'INR',
      }
    } : {}),
  };

  if (isPlanSwitch) {
    setFields.courseSelectionEnabled = true;
    setFields.selectedCourseIds = courseIdsToStore;
    setFields.selectedCourseCredits = Math.max(0, (plan.access?.courseSelection?.maxSelectableCourses || 0) - courseIdsToStore.length);
  } else {
    setFields.courseSelectionEnabled = false;
    setFields.selectedCourseCredits = 0;
    setFields.selectedCourseIds = [];
  }

  // Atomic upsert: findOneAndUpdate with upsert prevents race conditions
  const membership = await UserMembership.findOneAndUpdate(
    {
      userId,
      status: 'active',
    },
    {
      $set: setFields,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  );

  return membership;
};
