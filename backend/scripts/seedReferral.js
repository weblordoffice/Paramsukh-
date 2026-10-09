import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ReferralConfig from '../src/models/referralConfig.models.js';
import ReferralEarningRule from '../src/models/referralEarningRule.models.js';

dotenv.config();

const CONFIG = {
  isActive: true,
  pointValueInRupees: 1,
  referralCodeFormat: 'displayName',
  minRedemptionPoints: 50,
  maxRedemptionPercent: 50,
  pointsExpireMonths: 12,
  maxPointsPerReferrerTotal: 50000,
  // Dev-friendly: fresh accounts can refer (prod default is 7 days)
  minReferrerAccountAgeDays: 0,
  maxReferralsPerIP24h: 50,
  purchasePointsHoldDays: 7,
  notifyOnEarn: true,
  notifyOnRedeem: true,
};

const RULES = [
  { name: 'Signup Bonus', slug: 'user-signup', triggerEvent: 'user.signup', pointsValue: 10, isActive: true, cooldownPerUser: 1, holdDays: 0, displayOrder: 0, description: 'Awarded when a referred user signs up.' },
  { name: 'First Purchase', slug: 'user-first-purchase', triggerEvent: 'user.first_purchase', pointsValue: 20, isActive: true, cooldownPerUser: 1, holdDays: 0, displayOrder: 1, description: 'Awarded on the referred user’s first paid purchase (held for the config hold period).' },
  { name: 'Course Completed', slug: 'user-course-complete', triggerEvent: 'user.course_complete', pointsValue: 25, isActive: true, cooldownPerUser: 1, holdDays: 0, displayOrder: 2, description: 'Awarded when the referred user completes a course.' },
];

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

  // Exactly one settings document
  await ReferralConfig.deleteMany({});
  const config = await ReferralConfig.create(CONFIG);

  for (const rule of RULES) {
    await ReferralEarningRule.updateOne({ slug: rule.slug }, { $set: rule }, { upsert: true });
  }
  const ruleCount = await ReferralEarningRule.countDocuments({ isActive: true });

  console.log(`Seeded referral config + ${ruleCount} earning rules into "${dbName}".`);
  console.log(`  pointValueInRupees=${config.pointValueInRupees} minRedemptionPoints=${config.minRedemptionPoints} minReferrerAccountAgeDays=${config.minReferrerAccountAgeDays} purchasePointsHoldDays=${config.purchasePointsHoldDays}`);
  RULES.forEach((r) => console.log(`  rule ${r.slug} (${r.triggerEvent}) = ${r.pointsValue} pts`));

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
