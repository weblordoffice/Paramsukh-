/**
 * Wipe plans, courses and community data (dev/test reset).
 *
 * Deletes: membership plans + user memberships, courses + course content,
 * course/plan mappings, enrollments, and community groups/members/posts/comments.
 * Keeps: users, admins, and unrelated domains (events, shop, podcasts, etc.).
 *
 * Users are kept, but their subscription fields are reset to the free plan.
 *
 * Usage: node scripts/wipe-plans-courses-community.js --yes
 */
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { assertSafeDestructiveTarget } from '../src/utils/dbSafety.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/paramsukh';

const COLLECTIONS = [
  // Plans & memberships
  'membershipplans',
  'usermemberships',
  'membershipselectionlogs',
  'adminpaymentlinks',
  // Courses & learning content
  'courses',
  'videos',
  'pdfs',
  'livesessions',
  'assignments',
  'enrollments',
  'courseplans',
  // Community (memberships + content)
  'groups',
  'groupmembers',
  'posts',
  'comments',
];

async function run() {
  await assertSafeDestructiveTarget({
    scriptName: 'wipe-plans-courses-community',
    action: 'delete plans, courses and community data',
  });

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  console.log(`Connected. Database: ${db.databaseName}\n`);

  let totalDeleted = 0;

  for (const name of COLLECTIONS) {
    const collection = db.collection(name);
    try {
      const count = await collection.countDocuments();
      if (count > 0) {
        const result = await collection.deleteMany({});
        console.log(`  [DELETED] ${name}: ${result.deletedCount}`);
        totalDeleted += result.deletedCount;
      } else {
        console.log(`  [EMPTY]   ${name}`);
      }
    } catch (error) {
      console.log(`  [MISSING] ${name} (${error.message})`);
    }
  }

  // Keep users, but drop references to the now-deleted plans.
  const users = db.collection('users');
  const reset = await users.updateMany(
    {},
    {
      $set: { subscriptionPlan: 'free', subscriptionStatus: 'inactive' },
      $unset: {
        subscriptionStartDate: '',
        subscriptionEndDate: '',
        trialEndsAt: '',
        pendingMembershipPaymentLink: '',
      },
    }
  );
  console.log(`\n  [RESET] users subscription fields -> free: ${reset.modifiedCount}`);

  console.log(`\n============================================`);
  console.log(`  TOTAL DELETED: ${totalDeleted} documents`);
  console.log(`  KEPT: users, admins, and unrelated domains`);
  console.log(`============================================`);

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
