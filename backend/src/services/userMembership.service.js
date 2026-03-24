import { MembershipPlan } from '../models/membershipPlan.models.js';
import { UserMembership } from '../models/userMembership.models.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

export const upsertActiveUserMembership = async ({
  userId,
  planSlug,
  startDate,
  endDate,
  source = 'purchase',
  payment = null,
  metadata = {},
}) => {
  const slug = normalize(planSlug);
  if (!userId || !slug || slug === 'free') {
    return null;
  }

  const plan = await MembershipPlan.findOne({ slug }).lean();
  if (!plan) {
    return null;
  }

  const planSnapshot = {
    title: plan.title,
    slug: plan.slug,
    pricing: {
      amount: Number(plan.pricing?.oneTime?.amount || 0),
      currency: plan.pricing?.oneTime?.currency || 'INR',
      type: 'one_time',
    },
  };

  const payload = {
    userId,
    planId: plan._id,
    planSnapshot,
    status: 'active',
    source,
    startDate: startDate || new Date(),
    endDate: endDate || new Date(Date.now() + Number(plan.validityDays || 365) * 24 * 60 * 60 * 1000),
    autoRenew: false,
    metadata,
  };

  if (payment) {
    payload.payment = {
      provider: payment.provider || 'manual',
      orderId: payment.orderId || null,
      paymentId: payment.paymentId || null,
      amount: Number(payment.amount || 0),
      currency: payment.currency || 'INR',
    };
  }

  const existingActive = await UserMembership.findOne({
    userId,
    status: 'active',
    endDate: { $gte: new Date() },
  }).sort({ endDate: -1 });

  if (existingActive) {
    existingActive.planId = payload.planId;
    existingActive.planSnapshot = payload.planSnapshot;
    existingActive.status = payload.status;
    existingActive.source = payload.source;
    existingActive.startDate = payload.startDate;
    existingActive.endDate = payload.endDate;
    existingActive.autoRenew = payload.autoRenew;
    existingActive.metadata = { ...(existingActive.metadata || {}), ...metadata };
    if (payload.payment) {
      existingActive.payment = payload.payment;
    }
    await existingActive.save();
    return existingActive;
  }

  return UserMembership.create(payload);
};
