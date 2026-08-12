import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const plans = await MembershipPlan.find({});
    console.log(`Found ${plans.length} plans in MembershipPlan:`);
    plans.forEach(p => {
      console.log(`- Title: ${p.title} | Slug: ${p.slug} | Status: ${p.status} | ID: ${p._id}`);
      console.log(`  Access Mode: ${p.access?.accessMode}`);
      console.log(`  Course Selection Enabled: ${p.access?.courseSelection?.enabled}`);
      console.log(`  Max Selectable Courses: ${p.access?.courseSelection?.maxSelectableCourses}`);
      console.log(`  Eligible Courses Mode: ${p.access?.courseSelection?.eligibleCoursesMode}`);
      console.log(`  Eligible Course IDs:`, p.access?.courseSelection?.eligibleCourseIds);
      console.log(`  Included In Plans:`, p.includedInPlans);
    });

    await mongoose.disconnect();
    console.log('Disconnected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
