import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/user.models.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';
import { UserMembership } from '../src/models/userMembership.models.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const normalize = (value) => String(value || '').trim().toLowerCase();

const run = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is undefined');
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const usersWithPaidPlan = await User.find({
      subscriptionPlan: { $nin: ['free', null, ''] },
    }).select('_id subscriptionPlan').lean();

    const usedSlugs = Array.from(
      new Set(usersWithPaidPlan.map((u) => normalize(u.subscriptionPlan)).filter(Boolean))
    );

    const existingPlans = await MembershipPlan.find({
      slug: { $in: usedSlugs },
    }).select('slug').lean();

    const existingSlugSet = new Set(existingPlans.map((p) => normalize(p.slug)));
    const orphanSlugs = usedSlugs.filter((slug) => !existingSlugSet.has(slug));

    if (orphanSlugs.length === 0) {
      console.log('No orphan user plans found.');
      return;
    }

    console.log(`Orphan plan slugs: ${orphanSlugs.join(', ')}`);

    const affectedUsers = await User.find({
      subscriptionPlan: { $in: orphanSlugs },
    }).select('_id').lean();

    const affectedUserIds = affectedUsers.map((u) => u._id);

    const userUpdate = await User.updateMany(
      { _id: { $in: affectedUserIds } },
      {
        $set: {
          subscriptionPlan: 'free',
          subscriptionStatus: 'inactive',
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          trialEndsAt: null,
        },
      }
    );

    const membershipUpdate = await UserMembership.updateMany(
      {
        userId: { $in: affectedUserIds },
        status: 'active',
        endDate: { $gte: new Date() },
      },
      {
        $set: {
          status: 'expired',
          endDate: new Date(),
          metadata: {
            sourceController: 'scripts.reconcile_orphan_user_plans',
            reason: 'orphan_plan_slug',
          },
        },
      }
    );

    console.log(`Users downgraded to free: ${userUpdate.modifiedCount}`);
    console.log(`Active userMemberships expired: ${membershipUpdate.modifiedCount}`);
    console.log('Reconciliation completed successfully.');
  } catch (error) {
    console.error('Failed to reconcile orphan plans:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run();
