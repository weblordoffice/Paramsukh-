import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';

dotenv.config({ path: '.env' });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const run = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is undefined');
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const totalPlans = await MembershipPlan.countDocuments({});
    const plansWithCategories = await MembershipPlan.countDocuments({
      'access.includedCategories.0': { $exists: true },
    });

    console.log(`Total plans: ${totalPlans}`);
    console.log(`Plans with stored categories: ${plansWithCategories}`);

    const result = await MembershipPlan.updateMany(
      {},
      { $set: { 'access.includedCategories': [] } }
    );

    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);
    console.log('Plan categories cleared successfully.');
  } catch (error) {
    console.error('Failed to clear plan categories:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run();
