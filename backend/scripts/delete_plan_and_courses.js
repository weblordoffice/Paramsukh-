import connectDatabase from '../src/config/database.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';
import { Course } from '../src/models/course.models.js';
import { CoursePlan } from '../src/models/coursePlan.models.js';
import { User } from '../src/models/user.models.js';
import { UserMembership } from '../src/models/userMembership.models.js';

const slug = 'silver';

const run = async () => {
  try {
    await connectDatabase();

    const plan = await MembershipPlan.findOne({ slug });
    if (!plan) {
      console.error(`Membership plan with slug "${slug}" not found.`);
      process.exit(1);
    }

    console.log(`Found plan: ${plan.title} (${plan._id})`);

    // Unset subscriptionPlan from users who reference this slug
    const usersResult = await User.updateMany(
      { subscriptionPlan: slug },
      { $unset: { subscriptionPlan: '' } }
    );
    console.log(`Unset subscriptionPlan for ${usersResult.modifiedCount || usersResult.nModified || 0} user(s).`);

    // Expire active UserMemberships for this plan
    const activeMemberships = await UserMembership.updateMany(
      { planId: plan._id, status: 'active' },
      { $set: { status: 'expired', endDate: new Date() } }
    );
    console.log(`Updated ${activeMemberships.modifiedCount || activeMemberships.nModified || 0} active UserMembership(s) to expired.`);

    // Find courseIds mapped to this plan via CoursePlan
    const mappings = await CoursePlan.find({ planId: plan._id }).select('courseId').lean();
    const courseIds = Array.from(new Set(mappings.map(m => String(m.courseId))));
    console.log(`Found ${courseIds.length} course(s) linked via CoursePlan.`);

    // Also find Course docs that have includedInPlans array referencing this slug (legacy)
    const legacyCourses = await Course.find({ includedInPlans: slug }).select('_id').lean();
    const legacyCourseIds = legacyCourses.map(c => String(c._id));
    const allCourseIds = Array.from(new Set([...courseIds, ...legacyCourseIds]));

    // Delete courses
    if (allCourseIds.length > 0) {
      const del = await Course.deleteMany({ _id: { $in: allCourseIds } });
      console.log(`Deleted ${del.deletedCount || del.n || 0} Course document(s).`);
    } else {
      console.log('No Course documents to delete.');
    }

    // Clean CoursePlan mappings for this plan
    const cpDel = await CoursePlan.deleteMany({ planId: plan._id });
    console.log(`Deleted ${cpDel.deletedCount || cpDel.n || 0} CoursePlan mapping(s) for the plan.`);

    // Remove plan from inheritedPlanIds in other plans
    const inheritUpdate = await MembershipPlan.updateMany(
      { 'access.inheritedPlanIds': plan._id },
      { $pull: { 'access.inheritedPlanIds': plan._id } }
    );
    console.log(`Updated ${inheritUpdate.modifiedCount || inheritUpdate.nModified || 0} MembershipPlan(s) removing inheritance.`);

    // Finally delete the membership plan
    const deletedPlan = await MembershipPlan.findByIdAndDelete(plan._id);
    if (deletedPlan) {
      console.log(`Deleted membership plan '${slug}'.`);
    } else {
      console.log('Failed to delete membership plan (not found during final delete).');
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error during deletion script:', err);
    process.exit(2);
  }
};

run();
