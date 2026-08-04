import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI is missing in .env');
  process.exit(1);
}

async function clean() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // 1. Delete all UserMemberships
    const umResult = await db.collection('usermemberships').deleteMany({});
    console.log(`Deleted ${umResult.deletedCount} UserMembership(s)`);

    // 2. Delete all Enrollments
    const enResult = await db.collection('enrollments').deleteMany({});
    console.log(`Deleted ${enResult.deletedCount} Enrollment(s)`);

    // 3. Delete all Transactions (membership source)
    const txnResult = await db.collection('transactions').deleteMany({});
    console.log(`Deleted ${txnResult.deletedCount} Transaction(s)`);

    // 4. Delete all AdminPaymentLinks
    const aplResult = await db.collection('adminpaymentlinks').deleteMany({});
    console.log(`Deleted ${aplResult.deletedCount} AdminPaymentLink(s)`);

    // 5. Delete all MembershipSelectionLogs
    const mslResult = await db.collection('membershipselectionlogs').deleteMany({});
    console.log(`Deleted ${mslResult.deletedCount} MembershipSelectionLog(s)`);

    // 6. Reset all users: clear subscription, payments, trial
    const userResult = await db.collection('users').updateMany(
      {},
      {
        $set: {
          subscriptionPlan: 'free',
          subscriptionStatus: 'inactive',
          payments: [],
        },
        $unset: {
          subscriptionStartDate: '',
          subscriptionEndDate: '',
          trialEndsAt: '',
        }
      }
    );
    console.log(`Reset ${userResult.modifiedCount} user(s) to free tier`);

    // 7. Deactivate community group members
    const gmResult = await db.collection('groupmembers').updateMany(
      {},
      { $set: { isActive: false, leftAt: new Date() } }
    );
    console.log(`Deactivated ${gmResult.modifiedCount} GroupMember(s)`);

    // 8. Reset course enrollment counts to 0
    const courseResult = await db.collection('courses').updateMany(
      {},
      { $set: { enrollmentCount: 0 } }
    );
    console.log(`Reset enrollmentCount for ${courseResult.modifiedCount} course(s)`);

    console.log('\nDone. All subscriptions cleared.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Clean-up failed:', error);
    process.exit(1);
  }
}

clean();
