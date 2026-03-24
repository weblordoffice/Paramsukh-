import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import connectDatabase from '../src/config/database.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_PLANS = [
  {
    title: 'Bronze',
    slug: 'bronze',
    shortDescription: 'Begin your journey with foundational wellness content.',
    longDescription: 'Bronze gives starter access with focused category coverage and guided support.',
    status: 'published',
    displayOrder: 1,
    pricing: {
      oneTime: { amount: 2999, currency: 'INR' },
      recurring: {
        monthly: { amount: 399, currency: 'INR' },
        yearly: { amount: 2999, currency: 'INR' },
      },
    },
    validityDays: 365,
    access: {
      includedCategories: ['physical'],
      includedCourseIds: [],
      limits: { maxCategories: null, maxCoursesTotal: 1 },
      accessMode: 'auto_enroll',
      communityAccess: true,
      counselingAccess: true,
      eventAccess: true,
    },
    benefits: [
      { text: '1 foundational course', included: true },
      { text: 'Community access', included: true },
      { text: 'Membership counseling support', included: true },
      { text: 'Advanced course access', included: false },
    ],
    metadata: {
      badgeColor: '#CD7F32',
      icon: '🥉',
      popular: false,
    },
  },
  {
    title: 'Copper',
    slug: 'copper',
    shortDescription: 'Expand your access across multiple categories.',
    longDescription: 'Copper unlocks broader foundational coverage across key categories.',
    status: 'published',
    displayOrder: 2,
    pricing: {
      oneTime: { amount: 5999, currency: 'INR' },
      recurring: {
        monthly: { amount: 699, currency: 'INR' },
        yearly: { amount: 5999, currency: 'INR' },
      },
    },
    validityDays: 365,
    access: {
      includedCategories: ['physical', 'mental', 'spiritual'],
      includedCourseIds: [],
      limits: { maxCategories: null, maxCoursesTotal: 3 },
      accessMode: 'auto_enroll',
      communityAccess: true,
      counselingAccess: true,
      eventAccess: true,
    },
    benefits: [
      { text: 'Up to 3 foundational courses', included: true },
      { text: 'Priority community interactions', included: true },
      { text: 'Membership counseling support', included: true },
      { text: 'Advanced course access', included: false },
    ],
    metadata: {
      badgeColor: '#B87333',
      icon: '🔶',
      popular: false,
    },
  },
  {
    title: 'Silver',
    slug: 'silver',
    shortDescription: 'Most popular plan with broad foundational access.',
    longDescription: 'Silver includes all core categories and premium support features.',
    status: 'published',
    displayOrder: 3,
    pricing: {
      oneTime: { amount: 16999, currency: 'INR' },
      recurring: {
        monthly: { amount: 1899, currency: 'INR' },
        yearly: { amount: 16999, currency: 'INR' },
      },
    },
    validityDays: 365,
    access: {
      includedCategories: ['physical', 'mental', 'financial', 'relationship', 'spiritual'],
      includedCourseIds: [],
      limits: { maxCategories: null, maxCoursesTotal: null },
      accessMode: 'hybrid',
      communityAccess: true,
      counselingAccess: true,
      eventAccess: true,
    },
    benefits: [
      { text: 'All foundational categories', included: true },
      { text: 'Premium community access', included: true },
      { text: 'Membership counseling support', included: true },
      { text: 'Advanced course access', included: true },
    ],
    metadata: {
      badgeColor: '#A8A9AD',
      icon: '🥈',
      popular: true,
    },
  },
];

const seedMembershipPlans = async () => {
  try {
    await connectDatabase();

    const upsertResults = [];
    for (const plan of DEFAULT_PLANS) {
      const result = await MembershipPlan.findOneAndUpdate(
        { slug: plan.slug },
        { $set: plan },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      upsertResults.push(result.slug);
    }

    console.log(`Seeded/updated membership plans: ${upsertResults.join(', ')}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed membership plans:', error);
    process.exit(1);
  }
};

seedMembershipPlans();
