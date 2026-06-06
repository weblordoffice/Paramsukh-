import connectDatabase from '../src/config/database.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';
import { Course } from '../src/models/course.models.js';
import { CoursePlan } from '../src/models/coursePlan.models.js';
import { User } from '../src/models/user.models.js';
import { UserMembership } from '../src/models/userMembership.models.js';

const slug = 'silver';

const run = async () => {
  await connectDatabase();
  const plan = await MembershipPlan.findOne({ slug });
  console.log('MembershipPlan found?', !!plan);
  if (plan) console.log('Plan id:', plan._id.toString());

  const users = await User.countDocuments({ subscriptionPlan: slug });
  console.log('Users with subscriptionPlan:', users);

  const memberships = plan ? await UserMembership.countDocuments({ planId: plan._id }) : 0;
  console.log('UserMemberships for plan:', memberships);

  const cp = plan ? await CoursePlan.countDocuments({ planId: plan._id }) : 0;
  console.log('CoursePlan mappings for plan:', cp);

  const coursesByLegacy = await Course.countDocuments({ includedInPlans: slug });
  console.log('Courses with includedInPlans array referencing slug:', coursesByLegacy);

  const coursesByCp = plan ? await Course.countDocuments({ _id: { $in: (await CoursePlan.find({ planId: plan._id }).select('courseId').lean()).map(m=>m.courseId) } }) : 0;
  console.log('Courses referenced by CoursePlan mappings count:', coursesByCp);

  process.exit(0);
};

run();
