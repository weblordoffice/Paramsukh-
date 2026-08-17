/**
 * Wipe membership + payment data for a user so they can retest cleanly.
 * Usage: node scripts/wipe-user-membership.js <email or userId>
 */
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/paramsukh';

async function run() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error('Usage: node scripts/wipe-user-membership.js <email or userId>');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }));
  const UserMembership = mongoose.model('UserMembership', new mongoose.Schema({}, { strict: false, collection: 'usermemberships' }));
  const Enrollment = mongoose.model('Enrollment', new mongoose.Schema({}, { strict: false, collection: 'enrollments' }));
  const MembershipSelectionLog = mongoose.model('MembershipSelectionLog', new mongoose.Schema({}, { strict: false, collection: 'membershipselectionlogs' }));
  const Transaction = mongoose.model('Transaction', new mongoose.Schema({}, { strict: false, collection: 'transactions' }));
  const GroupMember = mongoose.model('GroupMember', new mongoose.Schema({}, { strict: false, collection: 'groupmembers' }));

  const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
  const user = isObjectId
    ? await User.findById(identifier).lean()
    : await User.findOne({ email: identifier }).lean();

  if (!user) {
    console.error(`User not found: ${identifier}`);
    process.exit(1);
  }

  const userId = String(user._id);
  const userIdObjectId = new mongoose.Types.ObjectId(userId);
  console.log(`Found user: ${user.email || user._id} (ID: ${userId})`);

  // 1. Delete UserMembership docs
  const membershipResult = await UserMembership.deleteMany({ userId: userIdObjectId });
  console.log(`Deleted ${membershipResult.deletedCount} UserMembership doc(s)`);

  // 2. Reset subscription fields on User
  await User.findByIdAndUpdate(userId, {
    $set: {
      subscriptionPlan: 'free',
      subscriptionStatus: 'inactive',
      payments: [],
      subscriptionPlanVariant: null,
    },
    $unset: {
      subscriptionStartDate: '',
      subscriptionEndDate: '',
      trialEndsAt: '',
      pendingMembershipPaymentLink: '',
    },
  });
  console.log('Reset subscriptionPlan → free, subscriptionStatus → inactive, cleared payments');

  // 3. Delete Enrollments
  const enrollmentResult = await Enrollment.deleteMany({ userId: userIdObjectId });
  console.log(`Deleted ${enrollmentResult.deletedCount} Enrollment(s)`);

  // 4. Delete selection logs
  const logResult = await MembershipSelectionLog.deleteMany({ userId: userIdObjectId });
  console.log(`Deleted ${logResult.deletedCount} MembershipSelectionLog(s)`);

  // 5. Delete transactions
  const txnResult = await Transaction.deleteMany({ userId: userIdObjectId });
  console.log(`Deleted ${txnResult.deletedCount} Transaction(s)`);

  // 6. Delete community group memberships
  const Group = mongoose.model('Group', new mongoose.Schema({}, { strict: false, collection: 'groups' }));
  const gmDocs = await GroupMember.find({ userId: userIdObjectId }).select('groupId').lean();
  const groupIds = gmDocs.map((doc) => doc.groupId);
  const gmResult = await GroupMember.deleteMany({ userId: userIdObjectId });
  console.log(`Deleted ${gmResult.deletedCount} GroupMember(s)`);

  if (groupIds.length > 0) {
    await Group.updateMany(
      { _id: { $in: groupIds }, memberCount: { $gt: 0 } },
      { $inc: { memberCount: -1 } }
    );
    console.log(`Decremented memberCount on ${groupIds.length} group(s)`);
  }

  console.log('\nDone. User is now clean. Restart your mobile app and refresh.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
