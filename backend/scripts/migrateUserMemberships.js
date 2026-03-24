import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import connectDatabase from '../src/config/database.js';
import { User } from '../src/models/user.models.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';
import { UserMembership } from '../src/models/userMembership.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const normalize = (value) => String(value || '').trim().toLowerCase();

const getPlanSnapshot = (plan, fallbackSlug) => {
  const amount = Number(plan?.pricing?.oneTime?.amount || 0);
  const currency = plan?.pricing?.oneTime?.currency || 'INR';

  return {
    title: plan?.title || fallbackSlug.toUpperCase(),
    slug: fallbackSlug,
    pricing: {
      amount,
      currency,
      type: 'one_time',
    },
  };
};

const migrate = async () => {
  try {
    await connectDatabase();

    const plans = await MembershipPlan.find({}).lean();
    const planBySlug = new Map(plans.map((plan) => [normalize(plan.slug), plan]));

    const users = await User.find({}).lean();
    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
      const planSlug = normalize(user.subscriptionPlan || 'free');
      const status = normalize(user.subscriptionStatus || 'inactive');

      const isPaidPlan = planSlug && planSlug !== 'free';
      const hasActiveLikeStatus = ['active', 'trial', 'inactive', 'cancelled'].includes(status);
      if (!isPaidPlan || !hasActiveLikeStatus) {
        skipped += 1;
        continue;
      }

      const existing = await UserMembership.findOne({
        userId: user._id,
        'planSnapshot.slug': planSlug,
      }).lean();

      if (existing) {
        skipped += 1;
        continue;
      }

      const plan = planBySlug.get(planSlug);
      if (!plan) {
        skipped += 1;
        console.warn(`Skipping user ${user._id}: no MembershipPlan found for slug '${planSlug}'`);
        continue;
      }

      const startDate = user.subscriptionStartDate || user.createdAt || new Date();
      const fallbackEnd = new Date(new Date(startDate).getTime() + (Number(plan.validityDays || 365) * 24 * 60 * 60 * 1000));
      const endDate = user.subscriptionEndDate || fallbackEnd;

      const latestPayment = Array.isArray(user.payments) && user.payments.length > 0
        ? user.payments[user.payments.length - 1]
        : null;

      await UserMembership.create({
        userId: user._id,
        planId: plan._id,
        planSnapshot: getPlanSnapshot(plan, planSlug),
        status: status === 'trial' ? 'active' : (status === 'inactive' ? 'paused' : status),
        source: 'migration',
        startDate,
        endDate,
        autoRenew: false,
        payment: {
          provider: latestPayment ? 'razorpay' : 'manual',
          orderId: latestPayment?.orderId || null,
          paymentId: latestPayment?.paymentId || null,
          amount: Number(latestPayment?.amount || plan.pricing?.oneTime?.amount || 0),
          currency: 'INR',
        },
        metadata: {
          migratedAt: new Date().toISOString(),
          legacyUserSubscriptionStatus: user.subscriptionStatus,
        },
      });

      migrated += 1;
    }

    console.log(`User memberships migration complete. Migrated: ${migrated}, Skipped: ${skipped}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to migrate user memberships:', error);
    process.exit(1);
  }
};

migrate();
