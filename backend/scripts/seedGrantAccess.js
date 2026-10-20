import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import connectDatabase from '../src/config/database.js';
import { Course } from '../src/models/course.models.js';
import { Enrollment } from '../src/models/enrollment.models.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';
import { User } from '../src/models/user.models.js';
import { UserMembership } from '../src/models/userMembership.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const EMAIL = 'workwithneeraj.01@gmail.com';
const PLAN_SLUG = 'copper';
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const run = async () => {
  await connectDatabase();
  console.log('Connected DB =', mongoose.connection.name);

  const user = await User.findOne({ email: EMAIL });
  if (!user) throw new Error(`User ${EMAIL} not found`);

  const plan = await MembershipPlan.findOne({ slug: PLAN_SLUG });
  if (!plan) throw new Error(`Plan ${PLAN_SLUG} not found`);

  const startDate = new Date();
  const endDate = new Date(Date.now() + YEAR_MS);

  await UserMembership.findOneAndUpdate(
    { userId: user._id, planId: plan._id, status: 'active' },
    {
      $set: {
        userId: user._id,
        planId: plan._id,
        status: 'active',
        source: 'admin_grant',
        startDate,
        endDate,
        autoRenew: false,
        planSnapshot: {
          title: plan.title,
          slug: plan.slug,
          variant: { slug: null, title: null, selectionKey: null },
          pricing: {
            amount: plan.pricing?.oneTime?.amount || 0,
            currency: plan.pricing?.oneTime?.currency || 'INR',
            type: 'one_time',
          },
        },
        payment: { provider: 'manual', amount: 0, currency: 'INR' },
        metadata: { seededBy: 'seedGrantAccess' },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        subscriptionPlan: PLAN_SLUG,
        subscriptionStatus: 'active',
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        assessmentCompleted: true,
        assessmentCompletedAt: new Date(),
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      },
    }
  );

  const courses = await Course.find({ status: 'published', includedInPlans: PLAN_SLUG }).select('title slug').lean();
  for (const course of courses) {
    await Enrollment.findOneAndUpdate(
      { userId: user._id, courseId: course._id },
      { $set: { userId: user._id, courseId: course._id, lastAccessedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`Granted ${plan.title} (${plan.slug}) to ${user.displayName} <${EMAIL}>`);
  console.log(`Enrolled in ${courses.length} courses:`, courses.map((c) => c.title).join(', '));
  process.exit(0);
};

run().catch((e) => { console.error(e); process.exit(1); });
