import path from 'path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import connectDatabase from '../src/config/database.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';
import { Course, Assignment } from '../src/models/course.models.js';
import { CourseAssessment } from '../src/models/courseAssessment.models.js';
import { CoursePlan } from '../src/models/coursePlan.models.js';
import { CourseActivitySubmission } from '../src/models/courseActivitySubmission.models.js';
import { Enrollment } from '../src/models/enrollment.models.js';
import { User } from '../src/models/user.models.js';
import { UserMembership } from '../src/models/userMembership.models.js';
import { AssessmentAttempt } from '../src/models/assessmentAttempt.models.js';
import {
  isPlanCoveredByUser,
  resolveMembershipPlanInheritanceFromPlan,
  resolvePlanCoverage,
} from '../src/services/membershipPlan.service.js';
import { evaluateCourseEnrollmentAccess } from '../src/services/entitlement.service.js';
import { getAutoEnrollCoursesForPlan } from '../src/services/membershipAccess.service.js';
import {
  getAssessmentOverview,
  startAssessmentAttempt,
  submitAssessmentAttempt,
} from '../src/services/courseAssessment.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DAY_MS = 24 * 60 * 60 * 1000;
const VIDEO_URL = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
const PDF_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

const assignmentMcq = (questionText, options, correctAnswer, explanation = '') => ({
  questionText,
  type: 'mcq',
  options,
  correctAnswer,
  explanation,
});

const assessmentMcq = (prompt, options, correctOptionKey) => ({
  prompt,
  type: 'mcq',
  options: options.map((text, index) => ({ key: String.fromCharCode(97 + index), text })),
  correctOptionKey,
  acceptedAnswers: [],
  gradingMode: 'exact',
  points: 1,
  isEnabled: true,
  explanation: '',
});

const assessmentShort = (prompt, acceptedAnswers) => ({
  prompt,
  type: 'short_answer',
  options: [],
  correctOptionKey: null,
  acceptedAnswers,
  gradingMode: 'exact',
  points: 1,
  isEnabled: true,
  explanation: '',
});

const TIERS = [
  {
    slug: 'bronze',
    title: 'Bronze',
    tierLevel: 1,
    displayOrder: 1,
    amount: 2999,
    monthly: 399,
    yearly: 2999,
    description: 'Tier 1 starter plan. Unlocks the Bronze course and builds a consistent daily wellness foundation.',
    color: '#CD7F32',
    icon: 'leaf',
    category: 'physical',
    courseTitle: 'Bronze Tier: Foundations of Daily Wellness',
    courseSlug: 'bronze-tier-foundations',
    courseDuration: '2 weeks',
    courseDescription: 'A beginner-friendly Bronze tier course focused on breath awareness, daily routine, and healthy foundational habits.',
    assignmentTitle: 'Bronze Tier Knowledge Check',
    assessmentTitle: 'Bronze Tier Certification Assessment',
  },
  {
    slug: 'copper',
    title: 'Copper',
    tierLevel: 2,
    displayOrder: 2,
    amount: 5999,
    monthly: 699,
    yearly: 5999,
    description: 'Tier 2 plan. Inherits Bronze and adds the Copper course for balancing habits, emotions, and energy.',
    color: '#B87333',
    icon: 'fitness',
    category: 'mental',
    courseTitle: 'Copper Tier: Building Balanced Habits',
    courseSlug: 'copper-tier-balanced-habits',
    courseDuration: '3 weeks',
    courseDescription: 'A Copper tier course that builds on the Bronze foundation with emotional balance, mindful routines, and sustainable habit design.',
    assignmentTitle: 'Copper Tier Knowledge Check',
    assessmentTitle: 'Copper Tier Certification Assessment',
  },
  {
    slug: 'silver',
    title: 'Silver',
    tierLevel: 3,
    displayOrder: 3,
    amount: 16999,
    monthly: 1899,
    yearly: 16999,
    description: 'Tier 3 plan. Inherits Copper and Bronze and adds the Silver course for advanced wellness integration.',
    color: '#94A3B8',
    icon: 'sparkles',
    category: 'spiritual',
    courseTitle: 'Silver Tier: Advanced Wellness Integration',
    courseSlug: 'silver-tier-advanced-integration',
    courseDuration: '4 weeks',
    courseDescription: 'A Silver tier course for integrating physical, mental, and spiritual practices into a resilient daily system.',
    assignmentTitle: 'Silver Tier Knowledge Check',
    assessmentTitle: 'Silver Tier Certification Assessment',
  },
];

const buildAssignmentQuestions = (tier) => {
  if (tier.slug === 'bronze') {
    return [
      assignmentMcq(
        'Which practice is the foundation of the Bronze tier?',
        ['Daily breath awareness', 'Skipping sleep', 'Intense fasting', 'Ignoring stress'],
        'Daily breath awareness',
        'Daily breath awareness is the core Bronze practice.'
      ),
      assignmentMcq(
        'How often should you complete the Bronze foundational practice?',
        ['Daily', 'Once a year', 'Never', 'Only when stressed'],
        'Daily',
        'Consistency matters more than duration.'
      ),
      assignmentMcq(
        'What is the best way to measure Bronze progress?',
        ['Consistency over time', 'How quickly you finish', 'Number of shortcuts', 'Avoiding practice'],
        'Consistency over time',
        'The Bronze tier rewards steady repetition.'
      ),
    ];
  }

  if (tier.slug === 'copper') {
    return [
      assignmentMcq(
        'What does the Copper tier build on?',
        ['The Bronze foundation', 'Nothing at all', 'Only advanced practices', 'Silver certification'],
        'The Bronze foundation',
        'Copper inherits and extends the Bronze foundation.'
      ),
      assignmentMcq(
        'Which habit supports emotional balance in the Copper tier?',
        ['A regular mindfulness routine', 'Ignoring feelings', 'Skipping reflection', 'Overworking'],
        'A regular mindfulness routine',
        'A regular routine helps regulate energy and emotion.'
      ),
      assignmentMcq(
        'What should you do when a habit feels unsustainable?',
        ['Make it smaller and more consistent', 'Quit immediately', 'Double the intensity', 'Ignore the warning signs'],
        'Make it smaller and more consistent',
        'Sustainable habits are built through small, repeatable steps.'
      ),
    ];
  }

  return [
    assignmentMcq(
      'What is the goal of the Silver tier?',
      ['Integrate practices into daily life', 'Avoid all routines', 'Replace sleep with practice', 'Skip the lower tiers'],
      'Integrate practices into daily life',
      'Silver focuses on integration and resilience.'
    ),
    assignmentMcq(
      'Which approach best supports advanced integration?',
      ['A balanced routine across body, mind, and spirit', 'One extreme practice only', 'Ignoring recovery', 'Avoiding reflection'],
      'A balanced routine across body, mind, and spirit',
      'Integration means balancing multiple dimensions.'
    ),
    assignmentMcq(
      'How should you review your Silver progress?',
      ['Reflect and adjust regularly', 'Never review', 'Only compare with others', 'Ignore your own experience'],
      'Reflect and adjust regularly',
      'Regular review keeps the system adaptive.'
    ),
  ];
};

const buildAssessmentQuestions = (tier) => {
  if (tier.slug === 'bronze') {
    return [
      assessmentMcq(
        'What is the primary focus of the Bronze tier?',
        ['Advanced mastery', 'A consistent foundational routine', 'Skipping fundamentals', 'Only live sessions'],
        'b'
      ),
      assessmentMcq(
        'Which habit belongs to the Bronze practice?',
        ['Daily breath awareness', 'Irregular all-night sessions', 'Ignoring sleep', 'Avoiding practice'],
        'a'
      ),
      assessmentMcq(
        'What should you do before a practice session?',
        ['Check social media', 'Rush through it', 'Set a clear intention', 'Skip preparation'],
        'c'
      ),
      assessmentMcq(
        'How should a beginner measure progress?',
        ['Consistency over time', 'Number of shortcuts', 'Speed of completion', 'Avoiding all practice'],
        'a'
      ),
      assessmentShort(
        'Type the word that means steady, repeated practice.',
        ['consistency', 'consistent']
      ),
    ];
  }

  if (tier.slug === 'copper') {
    return [
      assessmentMcq(
        'What does the Copper tier inherit?',
        ['Silver only', 'The Bronze foundation', 'No lower tier', 'Only community access'],
        'b'
      ),
      assessmentMcq(
        'Which skill is emphasized in the Copper tier?',
        ['Emotional balance', 'Ignoring stress', 'Overworking', 'Skipping reflection'],
        'a'
      ),
      assessmentMcq(
        'What makes a Copper habit sustainable?',
        ['Small repeatable steps', 'Extreme intensity', 'No rest days', 'Constant change'],
        'a'
      ),
      assessmentMcq(
        'How should you respond when a routine stops working?',
        ['Reflect and adjust it', 'Abandon all routines', 'Double the workload', 'Ignore the problem'],
        'a'
      ),
      assessmentShort(
        'Type the word that describes a balanced, steady approach.',
        ['balance', 'balanced']
      ),
    ];
  }

  return [
    assessmentMcq(
      'What is the main goal of the Silver tier?',
      ['Advanced wellness integration', 'Skipping the basics', 'Avoiding practice', 'Only reading content'],
      'a'
    ),
    assessmentMcq(
      'Which dimensions does Silver integrate?',
      ['Body, mind, and spirit', 'Only physical training', 'Only entertainment', 'Only work'],
      'a'
    ),
    assessmentMcq(
      'What supports long-term Silver progress?',
      ['Reflection and adjustment', 'Ignoring feedback', 'Extreme routines', 'No recovery'],
      'a'
    ),
    assessmentMcq(
      'How should advanced practice be approached?',
      ['With balance and consistency', 'All at once', 'Without rest', 'Without any structure'],
      'a'
    ),
    assessmentShort(
      'Type the word that means combining practices into one balanced system.',
      ['integration', 'integrate']
    ),
  ];
};

const buildPlanPayload = (tier, inheritedPlanIds = []) => ({
  title: tier.title,
  slug: tier.slug,
  description: tier.description,
  status: 'published',
  displayOrder: tier.displayOrder,
  planKind: 'tiered',
  tierLevel: tier.tierLevel,
  pricing: {
    oneTime: { amount: tier.amount, currency: 'INR' },
    recurring: {
      monthly: { amount: tier.monthly, currency: 'INR' },
      yearly: { amount: tier.yearly, currency: 'INR' },
    },
  },
  validityDays: 365,
  isLifetime: false,
  access: {
    includedCategories: [],
    includedSubcategories: [],
    includedCourseIds: [],
    inheritedPlanIds,
    limits: {
      maxCategories: null,
      maxCoursesTotal: null,
      perCategoryCourseLimit: null,
    },
    accessMode: 'entitlement_only',
    communityAccess: true,
    counselingAccess: true,
    eventAccess: true,
    courseSelection: {
      enabled: false,
      maxSelectableCourses: 3,
      eligibleCoursesMode: 'all_published',
      eligibleCourseIds: [],
      eligibleCategories: [],
    },
  },
  benefits: [
    { text: `Tier ${tier.tierLevel} membership`, included: true },
    { text: `${tier.title} tier course access`, included: true },
    { text: inheritedPlanIds.length > 0 ? 'Includes all lower tiers' : 'Entry tier access', included: true },
    { text: 'Community access', included: true },
  ],
  previewVideos: [],
});

const mergeSubdocs = (existing, template, keyFn) => {
  const existingByKey = new Map((existing || []).map((item) => [keyFn(item), item]));
  return template.map((item) => ({
    ...item,
    _id: existingByKey.get(keyFn(item))?._id || new mongoose.Types.ObjectId(),
  }));
};

const upsertPlan = async (tier, inheritedPlanIds) => {
  let plan = await MembershipPlan.findOne({ slug: tier.slug });
  if (!plan) {
    plan = new MembershipPlan({ slug: tier.slug });
  }
  plan.set(buildPlanPayload(tier, inheritedPlanIds));
  await plan.save();
  return plan;
};

const upsertAssignment = async (tier) => {
  const title = tier.assignmentTitle;
  let assignment = await Assignment.findOne({ title });
  if (!assignment) {
    assignment = new Assignment({ title });
  }

  assignment.set({
    title,
    description: `Required quiz for the ${tier.title} tier. Answer all questions correctly to unlock the certification assessment.`,
    order: 1,
    isStandalone: true,
    requiredForAssessment: true,
    questions: mergeSubdocs(
      assignment.questions,
      buildAssignmentQuestions(tier),
      (question) => question.questionText
    ),
  });

  await assignment.save();
  return assignment;
};

const upsertCourse = async (tier, assignmentIds) => {
  let course = await Course.findOne({ slug: tier.courseSlug });
  if (!course) {
    course = new Course({ slug: tier.courseSlug });
  }

  const existing = course.toObject();
  const videos = [
    {
      title: `${tier.title} Tier Orientation`,
      description: `A short orientation video for the ${tier.title} tier.`,
      duration: '0:15',
      durationInSeconds: 15,
      videoUrl: VIDEO_URL,
      thumbnailUrl: null,
      order: 1,
      isFree: false,
      assignments: [],
    },
  ];
  const pdfs = [
    {
      title: `${tier.title} Tier Workbook`,
      description: `Printable workbook for the ${tier.title} tier exercises.`,
      pdfUrl: PDF_URL,
      thumbnailUrl: null,
      order: 1,
      isFree: false,
      fileSize: '1 KB',
    },
  ];

  course.set({
    title: tier.courseTitle,
    description: tier.courseDescription,
    shortDescription: tier.courseDescription,
    color: tier.color,
    icon: tier.icon,
    thumbnailUrl: null,
    bannerUrl: null,
    duration: tier.courseDuration,
    strictVideoOrder: false,
    category: tier.category,
    tags: [tier.slug, 'tier-test', 'seed'],
    includedInPlans: [tier.slug],
    status: 'published',
    publishedAt: course.publishedAt || new Date(),
    videos: mergeSubdocs(existing.videos, videos, (video) => video.title),
    pdfs: mergeSubdocs(existing.pdfs, pdfs, (pdf) => pdf.title),
    audioLessons: [],
    reflections: [],
    liveSessions: [],
    assignments: assignmentIds,
  });

  await course.save();
  return course;
};

const upsertAssessment = async (tier, course) => {
  let assessment = await CourseAssessment.findOne({ course: course._id });
  if (!assessment) {
    assessment = new CourseAssessment({ course: course._id });
  }

  const existing = assessment.toObject();
  assessment.set({
    title: tier.assessmentTitle,
    instructions: `Complete all ${tier.title} tier lessons and the required quiz before starting. You have 10 minutes and 3 attempts.`,
    questions: mergeSubdocs(
      existing.questions,
      buildAssessmentQuestions(tier).map((question, index) => ({ ...question, order: index + 1 })),
      (question) => question.prompt
    ),
    passingRule: { type: 'percentage', value: 60 },
    maxAttempts: 3,
    retakeCooldownHours: 0,
    timeLimitMinutes: 10,
    shuffleQuestions: false,
    isEnabled: true,
    vivaRequired: true,
  });

  await assessment.save();
  return assessment;
};

const upsertMappings = async (plan, course) => {
  await CoursePlan.deleteMany({ courseId: course._id });
  await CoursePlan.create({ courseId: course._id, planId: plan._id });
  plan.access.includedCourseIds = [course._id];
  await plan.save();
};

const seed = async () => {
  await connectDatabase();
  console.log(`\nTarget database: ${mongoose.connection.name}`);

  const seeded = { plans: {}, courses: {}, assignments: {}, assessments: {} };

  seeded.plans.bronze = await upsertPlan(TIERS[0], []);
  seeded.plans.copper = await upsertPlan(TIERS[1], [seeded.plans.bronze._id]);
  seeded.plans.silver = await upsertPlan(TIERS[2], [seeded.plans.copper._id]);

  for (const tier of TIERS) {
    const assignment = await upsertAssignment(tier);
    const course = await upsertCourse(tier, [assignment._id]);
    const assessment = await upsertAssessment(tier, course);
    await upsertMappings(seeded.plans[tier.slug], course);

    seeded.assignments[tier.slug] = assignment;
    seeded.courses[tier.slug] = course;
    seeded.assessments[tier.slug] = assessment;
  }

  console.log('\nSeeded plans:');
  console.table(
    TIERS.map((tier) => ({
      title: tier.title,
      slug: tier.slug,
      tierLevel: tier.tierLevel,
      inheritedFrom: tier.slug === 'bronze'
        ? '-'
        : tier.slug === 'copper'
          ? 'bronze'
          : 'copper',
      course: seeded.courses[tier.slug].title,
    }))
  );

  console.log('\nSeeded courses:');
  console.table(
    TIERS.map((tier) => {
      const course = seeded.courses[tier.slug];
      return {
        title: course.title,
        slug: course.slug,
        videos: course.videos.length,
        pdfs: course.pdfs.length,
        assignments: course.assignments.length,
        assessmentQuestions: seeded.assessments[tier.slug].questions.length,
        status: course.status,
      };
    })
  );

  return seeded;
};

const createTempUserWithPlan = async (tier, plan, stamp) => {
  const now = new Date();
  const endDate = new Date(now.getTime() + 365 * DAY_MS);
  const user = await User.create({
    displayName: `Tier Verify ${tier.title}`,
    email: `tier-seed-verify-${stamp}-${tier.slug}@example.com`,
    authProvider: 'clerk',
    subscriptionPlan: tier.slug,
    subscriptionStatus: 'active',
    subscriptionStartDate: now,
    subscriptionEndDate: endDate,
    onboardingCompleted: true,
    assessmentCompleted: true,
  });

  await UserMembership.create({
    userId: user._id,
    planId: plan._id,
    status: 'active',
    source: 'admin_grant',
    startDate: now,
    endDate,
    autoRenew: false,
    planSnapshot: {
      title: plan.title,
      slug: plan.slug,
      pricing: {
        amount: plan.pricing.oneTime.amount,
        currency: plan.pricing.oneTime.currency,
        type: 'one_time',
      },
    },
    payment: { provider: 'manual', amount: 0, currency: 'INR' },
    metadata: { seededBy: 'seedTierTestEnvironment' },
  });

  return user;
};

const createFreeTempUser = async (stamp) => User.create({
  displayName: 'Tier Verify Free',
  email: `tier-seed-verify-${stamp}-free@example.com`,
  authProvider: 'clerk',
  subscriptionPlan: 'free',
  subscriptionStatus: 'inactive',
  onboardingCompleted: true,
  assessmentCompleted: true,
});

const verify = async (seeded) => {
  const stamp = Date.now();
  const tempUserIds = [];

  try {
    console.log('\nVerifying tier inheritance...');
    const silverClosure = await resolveMembershipPlanInheritanceFromPlan(seeded.plans.silver);
    const silverSlugs = new Set(silverClosure.planSlugs);
    assert(silverSlugs.has('silver'), 'Silver closure must include silver');
    assert(silverSlugs.has('copper'), 'Silver closure must include copper');
    assert(silverSlugs.has('bronze'), 'Silver closure must include bronze');

    const copperClosure = await resolveMembershipPlanInheritanceFromPlan(seeded.plans.copper);
    const copperSlugs = new Set(copperClosure.planSlugs);
    assert(copperSlugs.has('copper'), 'Copper closure must include copper');
    assert(copperSlugs.has('bronze'), 'Copper closure must include bronze');
    assert(!copperSlugs.has('silver'), 'Copper must not include silver');

    console.log('  PASS: Silver -> Copper -> Bronze inheritance is correct.');

    const users = {
      bronze: await createTempUserWithPlan(TIERS[0], seeded.plans.bronze, stamp),
      copper: await createTempUserWithPlan(TIERS[1], seeded.plans.copper, stamp),
      silver: await createTempUserWithPlan(TIERS[2], seeded.plans.silver, stamp),
      free: await createFreeTempUser(stamp),
    };
    Object.values(users).forEach((user) => tempUserIds.push(user._id));

    const expectedAccess = {
      bronze: { bronze: true, copper: false, silver: false },
      copper: { bronze: true, copper: true, silver: false },
      silver: { bronze: true, copper: true, silver: true },
      free: { bronze: false, copper: false, silver: false },
    };

    console.log('\nVerifying course access matrix...');
    const rows = [];
    for (const [userTier, expectations] of Object.entries(expectedAccess)) {
      for (const courseTier of TIERS.map((tier) => tier.slug)) {
        const decision = await evaluateCourseEnrollmentAccess({
          userId: users[userTier]._id,
          course: seeded.courses[courseTier],
        });
        assert.equal(
          decision.allowed,
          expectations[courseTier],
          `${userTier} user accessing ${courseTier} course expected allowed=${expectations[courseTier]}, got ${decision.allowed} (${decision.reason})`
        );
        rows.push({
          userPlan: userTier,
          course: courseTier,
          allowed: decision.allowed,
          reason: decision.reason,
        });
      }
    }
    console.table(rows);
    console.log('  PASS: Tier course access matches the expected matrix.');

    console.log('\nVerifying upgrade/coverage flags...');
    const allPlans = Object.values(seeded.plans);
    const coverageFor = async (user) => {
      const entries = await resolvePlanCoverage(user._id, allPlans);
      return new Map(entries.map((entry) => [entry.slug, entry]));
    };

    const bronzeCoverage = await coverageFor(users.bronze);
    assert.equal(bronzeCoverage.get('bronze').isOwned, true, 'Bronze user should own bronze');
    assert.equal(bronzeCoverage.get('copper').isUpgrade, true, 'Copper should be an upgrade for a bronze user');
    assert.equal(bronzeCoverage.get('silver').isUpgrade, true, 'Silver should be an upgrade for a bronze user');

    const copperCoverage = await coverageFor(users.copper);
    assert.equal(copperCoverage.get('bronze').isCovered, true, 'Bronze should be covered for a copper user');
    assert.equal(copperCoverage.get('copper').isOwned, true, 'Copper user should own copper');
    assert.equal(copperCoverage.get('silver').isUpgrade, true, 'Silver should be an upgrade for a copper user');

    const silverCoverage = await coverageFor(users.silver);
    assert.equal(silverCoverage.get('bronze').isCovered, true, 'Bronze should be covered for a silver user');
    assert.equal(silverCoverage.get('copper').isCovered, true, 'Copper should be covered for a silver user');
    assert.equal(silverCoverage.get('silver').isOwned, true, 'Silver user should own silver');

    const coveredBronze = await isPlanCoveredByUser(users.silver._id, 'bronze');
    assert.equal(coveredBronze.covered, true, 'Silver user should not be offered Bronze again');
    const uncoveredCopper = await isPlanCoveredByUser(users.bronze._id, 'copper');
    assert.equal(uncoveredCopper.covered, false, 'Bronze user should still be offered Copper');
    console.log('  PASS: Owned/covered/upgrade flags match the tier ladder.');

    console.log('\nVerifying auto-enrollment course sets...');
    const autoEnroll = {};
    for (const tier of TIERS) {
      autoEnroll[tier.slug] = new Set(
        (await getAutoEnrollCoursesForPlan(tier.slug)).map((course) => course.slug)
      );
    }

    assert(autoEnroll.bronze.has('bronze-tier-foundations'), 'Bronze should auto-enroll the Bronze course');
    assert(!autoEnroll.bronze.has('copper-tier-balanced-habits'), 'Bronze must not auto-enroll the Copper course');
    assert(!autoEnroll.bronze.has('silver-tier-advanced-integration'), 'Bronze must not auto-enroll the Silver course');

    assert(autoEnroll.copper.has('bronze-tier-foundations'), 'Copper should auto-enroll the Bronze course');
    assert(autoEnroll.copper.has('copper-tier-balanced-habits'), 'Copper should auto-enroll the Copper course');
    assert(!autoEnroll.copper.has('silver-tier-advanced-integration'), 'Copper must not auto-enroll the Silver course');

    assert(autoEnroll.silver.has('bronze-tier-foundations'), 'Silver should auto-enroll the Bronze course');
    assert(autoEnroll.silver.has('copper-tier-balanced-habits'), 'Silver should auto-enroll the Copper course');
    assert(autoEnroll.silver.has('silver-tier-advanced-integration'), 'Silver should auto-enroll the Silver course');
    console.log('  PASS: Auto-enrollment includes all inherited lower-tier courses.');

    console.log('\nVerifying assessment and quiz flows...');
    for (const tier of TIERS) {
      const user = users[tier.slug];
      const course = seeded.courses[tier.slug];
      const assignment = seeded.assignments[tier.slug];

      const enrollment = await Enrollment.create({
        userId: user._id,
        courseId: course._id,
        completedVideos: course.videos.map((video) => video._id),
        completedPdfs: course.pdfs.map((pdf) => pdf._id),
        completedAudioLessons: [],
        completedReflections: [],
        completedRequiredAssignments: [assignment._id],
        progress: 100,
        isCompleted: true,
        completedAt: new Date(),
        assessmentUnlocked: true,
        currentVideoId: course.videos[0]?._id || null,
      });

      await CourseActivitySubmission.create({
        userId: user._id,
        courseId: course._id,
        type: 'quiz',
        assignmentId: assignment._id,
        answers: {},
        score: 3,
        maxScore: 3,
        percentage: 100,
        passed: true,
        attemptNumber: 1,
      });

      const overview = await getAssessmentOverview(user._id, course._id);
      assert(overview.assessment, `${tier.title}: assessment should exist`);
      assert(overview.eligibility.enrolled, `${tier.title}: user should be enrolled`);
      assert(overview.eligibility.learningComplete, `${tier.title}: learning should be complete`);
      assert(overview.eligibility.requiredAssignmentsComplete, `${tier.title}: required quiz should be complete`);
      assert(overview.canStart, `${tier.title}: assessment should be startable (${overview.blockedReason || 'no reason'})`);

      const started = await startAssessmentAttempt(user._id, course._id);
      assert(started.attempt, `${tier.title}: attempt should be created`);

      const assessment = await CourseAssessment.findById(seeded.assessments[tier.slug]._id);
      const answers = {};
      assessment.questions.forEach((question) => {
        answers[String(question._id)] = question.type === 'mcq'
          ? question.correctOptionKey
          : question.acceptedAnswers[0];
      });

      const result = await submitAssessmentAttempt({
        userId: user._id,
        courseId: course._id,
        attemptId: started.attempt._id,
        answers,
      });

      assert.equal(result.result.passed, true, `${tier.title}: seeded correct answers should pass`);

      await Enrollment.deleteOne({ _id: enrollment._id });

      console.log(`  PASS: ${tier.title} quiz unlock + assessment start/submit passed.`);
    }
  } finally {
    if (tempUserIds.length > 0) {
      await Promise.all([
        AssessmentAttempt.deleteMany({ user: { $in: tempUserIds } }),
        CourseActivitySubmission.deleteMany({ userId: { $in: tempUserIds } }),
        Enrollment.deleteMany({ userId: { $in: tempUserIds } }),
        UserMembership.deleteMany({ userId: { $in: tempUserIds } }),
        User.deleteMany({ _id: { $in: tempUserIds } }),
      ]);
      console.log('\nTemporary verification users and their records were removed.');
    }
  }
};

const run = async () => {
  try {
    const seeded = await seed();
    await verify(seeded);

    console.log('\nTier test environment is ready.');
    console.log('Admin plans: /dashboard/plans');
    console.log('Admin courses: /dashboard/courses');
    console.log('\nNotes:');
    console.log('- Bronze is tier 1 and grants only the Bronze course.');
    console.log('- Copper is tier 2 and inherits Bronze, so it grants Bronze + Copper.');
    console.log('- Silver is tier 3 and inherits Copper, so it grants Bronze + Copper + Silver.');
    console.log('- Each course has one required quiz and one enabled assessment.');
    console.log('- Assessments are set to vivaRequired=true so the existing certificate flow works.');
  } catch (error) {
    console.error('\nSeeding or verification failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
