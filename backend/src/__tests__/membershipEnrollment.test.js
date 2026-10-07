import { MembershipPlan } from '../models/membershipPlan.models.js';
import { Course } from '../models/course.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import {
  getInheritedCoursesForPlan,
  getAutoEnrollCoursesForPlan,
  autoEnrollUserInCourses,
} from '../services/membershipAccess.service.js';
import { getEligibleCourses } from '../services/courseSelection.service.js';
import { createTestUser } from './helpers.js';
import { setupDB } from './db.js';

setupDB();

const createCourse = (overrides = {}) => Course.create({
  title: 'Course',
  description: 'A course description',
  instructor: 'Instructor',
  level: 'beginner',
  category: 'physical',
  duration: '2 hours',
  lessonsCount: 1,
  isActive: true,
  price: 0,
  status: 'published',
  ...overrides,
});

describe('Membership course inheritance - cap on bought plan, grant lower tiers', () => {
  let user;
  let bronze;
  let copper;
  let silver;
  let bronzeCourse;
  let copperCourse;
  let silverCourse;

  beforeEach(async () => {
    user = await createTestUser();

    bronzeCourse = await createCourse({ title: 'Bronze Course', includedInPlans: ['bronze'] });
    copperCourse = await createCourse({ title: 'Copper Course', includedInPlans: ['copper'] });
    silverCourse = await createCourse({ title: 'Silver Course', includedInPlans: ['silver'] });

    bronze = await MembershipPlan.create({
      title: 'Bronze',
      slug: 'bronze',
      status: 'published',
      planKind: 'tiered',
      tierLevel: 1,
      pricing: { oneTime: { amount: 100, currency: 'INR' } },
      validityDays: 365,
    });

    // Lower tier WITH its own cap (should be ignored for a buyer of a higher plan).
    copper = await MembershipPlan.create({
      title: 'Copper',
      slug: 'copper',
      status: 'published',
      planKind: 'tiered',
      tierLevel: 2,
      pricing: { oneTime: { amount: 200, currency: 'INR' } },
      validityDays: 365,
      access: {
        inheritedPlanIds: [bronze._id],
        courseSelection: {
          enabled: true,
          maxSelectableCourses: 1,
          eligibleCoursesMode: 'specific',
          eligibleCourseIds: [copperCourse._id],
          eligibleCategories: [],
        },
      },
    });

    // Bought plan WITH a cap of its own.
    silver = await MembershipPlan.create({
      title: 'Silver',
      slug: 'silver',
      status: 'published',
      planKind: 'tiered',
      tierLevel: 3,
      pricing: { oneTime: { amount: 300, currency: 'INR' } },
      validityDays: 365,
      access: {
        inheritedPlanIds: [copper._id, bronze._id],
        courseSelection: {
          enabled: true,
          maxSelectableCourses: 5,
          eligibleCoursesMode: 'specific',
          eligibleCourseIds: [silverCourse._id],
          eligibleCategories: [],
        },
      },
    });
  });

  it('returns lower-tier courses but not the bought plan own course', async () => {
    const inherited = await getInheritedCoursesForPlan('silver');
    const titles = inherited.map((c) => c.title).sort();

    expect(titles).toEqual(['Bronze Course', 'Copper Course']);
    expect(titles).not.toContain('Silver Course');
  });

  it('getAutoEnrollCoursesForPlan returns the whole closure', async () => {
    const all = await getAutoEnrollCoursesForPlan('silver');
    const titles = all.map((c) => c.title).sort();

    expect(titles).toEqual(['Bronze Course', 'Copper Course', 'Silver Course']);
  });

  it('auto-enrolls all inherited courses regardless of the lower plans caps', async () => {
    const inherited = await getInheritedCoursesForPlan('silver');
    const enrolled = await autoEnrollUserInCourses(user._id, inherited);

    // Copper's own cap is 1 and Bronze has a cap-less selection — both ignored.
    expect(enrolled).toBe(2);

    const enrollments = await Enrollment.find({ userId: user._id }).select('courseId').lean();
    expect(enrollments).toHaveLength(2);
  });

  it('auto-enroll is idempotent (no duplicate enrollments)', async () => {
    const inherited = await getInheritedCoursesForPlan('silver');
    await autoEnrollUserInCourses(user._id, inherited);
    const secondPass = await autoEnrollUserInCourses(user._id, inherited);

    expect(secondPass).toBe(0);
    expect(await Enrollment.countDocuments({ userId: user._id })).toBe(2);
  });

  it('the bought plan picker exposes only the bought plan own courses', async () => {
    const membership = await UserMembership.create({
      userId: user._id,
      planId: silver._id,
      planSnapshot: {
        title: 'Silver',
        slug: 'silver',
        pricing: { amount: 300, currency: 'INR', type: 'one_time' },
      },
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      courseSelectionEnabled: true,
      selectedCourseCredits: 5,
      selectedCourseIds: [],
    });

    const eligible = await getEligibleCourses(user._id, membership._id);
    const titles = eligible.map((c) => c.title);

    expect(titles).toEqual(['Silver Course']);
  });
});
