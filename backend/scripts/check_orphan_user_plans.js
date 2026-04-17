import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/user.models.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const normalize = (value) => String(value || '').trim().toLowerCase();

const run = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is undefined');
    }

    await mongoose.connect(MONGO_URI);

    const usersWithPaidPlan = await User.find({
      subscriptionPlan: { $nin: ['free', null, ''] },
    }).select('subscriptionPlan').lean();

    const usedSlugs = Array.from(
      new Set(usersWithPaidPlan.map((u) => normalize(u.subscriptionPlan)).filter(Boolean))
    );

    const existingPlans = await MembershipPlan.find({
      slug: { $in: usedSlugs },
    }).select('slug').lean();

    const existingSlugSet = new Set(existingPlans.map((p) => normalize(p.slug)));
    const orphanSlugs = usedSlugs.filter((slug) => !existingSlugSet.has(slug));

    const orphanUsers = orphanSlugs.length > 0
      ? await User.countDocuments({ subscriptionPlan: { $in: orphanSlugs } })
      : 0;

    console.log(`Paid users: ${usersWithPaidPlan.length}`);
    console.log(`Used plan slugs: ${usedSlugs.length}`);
    console.log(`Orphan slugs: ${orphanSlugs.length > 0 ? orphanSlugs.join(', ') : 'none'}`);
    console.log(`Users on orphan slugs: ${orphanUsers}`);
  } catch (error) {
    console.error('Failed integrity check:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
