import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/user.models.js';
import { UserMembership } from '../src/models/userMembership.models.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const phone = '+917972531164';
    const user = await User.findOne({ phone });
    if (!user) {
      console.log(`User with phone ${phone} not found!`);
      await mongoose.disconnect();
      return;
    }

    const membership = await UserMembership.findOne({ userId: user._id, status: 'active' });
    if (!membership) {
      console.log(`No active membership found for user ${user.name}`);
      await mongoose.disconnect();
      return;
    }

    console.log('Existing Membership before repair:');
    console.log(JSON.stringify(membership, null, 2));

    const plan = await MembershipPlan.findOne({ slug: 'brown' });
    if (!plan) {
      console.log('Brown plan not found in database!');
      await mongoose.disconnect();
      return;
    }

    // Set correct values
    membership.planId = plan._id;
    membership.planSnapshot = {
      title: plan.title,
      slug: plan.slug,
      pricing: {
        amount: 2,
        currency: 'INR',
        type: 'one_time'
      }
    };
    membership.startDate = user.subscriptionStartDate || new Date();
    membership.endDate = user.subscriptionEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    membership.payment = {
      provider: 'razorpay',
      orderId: 'order_TOTjY1LfQYlOEh',
      paymentId: 'pay_TOTjzLfV7OWurh',
      amount: 2,
      currency: 'INR'
    };
    membership.source = 'purchase';

    await membership.save();
    console.log('\nRepair successful! Repaired Membership document:');
    console.log(JSON.stringify(membership, null, 2));

    await mongoose.disconnect();
    console.log('Disconnected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
