import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';

dotenv.config();

const LONG_DESCRIPTION =
  'Unlock the complete ParamSukh experience with our most comprehensive wellness membership. ' +
  'This plan gives you unlimited access to every foundational and advanced course across all five ' +
  'life categories — physical, mental, financial, relationship and spiritual — plus priority access ' +
  'to live sessions, one-to-one counseling with our senior guides, exclusive community circles, ' +
  'downloadable study materials, and early invitations to retreats and events. Members also receive ' +
  'personalised progress tracking, monthly accountability check-ins, and a dedicated support concierge ' +
  'to help you stay consistent on your transformation journey. Whether you are just beginning or ' +
  'deepening a long-standing practice, this membership is designed to walk with you every step of the way.';

const PLAN = {
  title: 'Platinum',
  slug: 'platinum',
  description: LONG_DESCRIPTION,
  status: 'published',
  displayOrder: 0,
  pricing: {
    oneTime: { amount: 4999, currency: 'INR' },
    recurring: {
      monthly: { amount: 599, currency: 'INR' },
      yearly: { amount: 4999, currency: 'INR' },
    },
  },
  validityDays: 365,
  access: {
    includedCategories: ['physical', 'mental', 'financial', 'relationship', 'spiritual'],
    includedCourseIds: [],
    limits: { maxCategories: null, maxCoursesTotal: null },
    accessMode: 'entitlement_only',
    communityAccess: true,
    counselingAccess: true,
    eventAccess: true,
  },
  benefits: [
    { text: 'All courses across every category', included: true },
    { text: 'Priority live-session access', included: true },
    { text: '1-on-1 senior counseling', included: true },
    { text: 'Exclusive community circles', included: true },
  ],
};

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const dbName = mongoose.connection.name;
  const devDb = process.env.DEV_MONGO_DB || 'psog_dev';

  if (dbName !== devDb && process.env.FORCE_SEED !== 'true') {
    console.error(`Refusing to seed non-dev database "${dbName}". Set FORCE_SEED=true to override.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const plan = await MembershipPlan.findOneAndUpdate(
    { slug: PLAN.slug },
    { $set: PLAN },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log(`Seeded "${plan.title}" (${plan.slug}) into "${dbName}" — status=${plan.status}, description length=${plan.description.length} chars.`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
