import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

import connectDatabase from '../src/config/database.js';
import { Course } from '../src/models/course.models.js';
import { Enrollment } from '../src/models/enrollment.models.js';
import { Event } from '../src/models/event.models.js';
import { EventRegistration } from '../src/models/eventRegistration.models.js';
import { MembershipPlan } from '../src/models/membershipPlan.models.js';
import Podcast from '../src/models/podcast.model.js';
import { User } from '../src/models/user.models.js';
import { UserMembership } from '../src/models/userMembership.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DEMO_USER_PHONE = '+919999999999';
const DAY_MS = 24 * 60 * 60 * 1000;

const defaultPlans = [
  {
    title: 'Bronze',
    slug: 'bronze',
    shortDescription: 'Begin your journey with foundational wellness content.',
    longDescription: 'Bronze gives starter access with focused category coverage and guided support.',
    status: 'published',
    displayOrder: 1,
    pricing: {
      oneTime: { amount: 2999, currency: 'INR' },
      recurring: {
        monthly: { amount: 399, currency: 'INR' },
        yearly: { amount: 2999, currency: 'INR' },
      },
    },
    validityDays: 365,
    access: {
      includedCategories: ['physical'],
      includedCourseIds: [],
      limits: { maxCategories: null, maxCoursesTotal: 1 },
      accessMode: 'auto_enroll',
      communityAccess: true,
      counselingAccess: true,
      eventAccess: true,
    },
    benefits: [
      { text: '1 foundational course', included: true },
      { text: 'Community access', included: true },
      { text: 'Membership counseling support', included: true },
      { text: 'Advanced course access', included: false },
    ],
    metadata: {
      badgeColor: '#CD7F32',
      icon: 'bronze',
      popular: false,
    },
  },
  {
    title: 'Copper',
    slug: 'copper',
    shortDescription: 'Expand your access across multiple categories.',
    longDescription: 'Copper unlocks broader foundational coverage across key categories.',
    status: 'published',
    displayOrder: 2,
    pricing: {
      oneTime: { amount: 5999, currency: 'INR' },
      recurring: {
        monthly: { amount: 699, currency: 'INR' },
        yearly: { amount: 5999, currency: 'INR' },
      },
    },
    validityDays: 365,
    access: {
      includedCategories: ['physical', 'mental', 'spiritual'],
      includedCourseIds: [],
      limits: { maxCategories: null, maxCoursesTotal: 3 },
      accessMode: 'auto_enroll',
      communityAccess: true,
      counselingAccess: true,
      eventAccess: true,
    },
    benefits: [
      { text: 'Up to 3 foundational courses', included: true },
      { text: 'Priority community interactions', included: true },
      { text: 'Membership counseling support', included: true },
      { text: 'Advanced course access', included: false },
    ],
    metadata: {
      badgeColor: '#B87333',
      icon: 'copper',
      popular: false,
    },
  },
  {
    title: 'Silver',
    slug: 'silver',
    shortDescription: 'Most popular plan with broad foundational access.',
    longDescription: 'Silver includes all core categories and premium support features.',
    status: 'published',
    displayOrder: 3,
    pricing: {
      oneTime: { amount: 16999, currency: 'INR' },
      recurring: {
        monthly: { amount: 1899, currency: 'INR' },
        yearly: { amount: 16999, currency: 'INR' },
      },
    },
    validityDays: 365,
    access: {
      includedCategories: ['physical', 'mental', 'financial', 'relationship', 'spiritual'],
      includedCourseIds: [],
      limits: { maxCategories: null, maxCoursesTotal: null },
      accessMode: 'hybrid',
      communityAccess: true,
      counselingAccess: true,
      eventAccess: true,
    },
    benefits: [
      { text: 'All foundational categories', included: true },
      { text: 'Premium community access', included: true },
      { text: 'Membership counseling support', included: true },
      { text: 'Advanced course access', included: true },
    ],
    metadata: {
      badgeColor: '#A8A9AD',
      icon: 'silver',
      popular: true,
    },
  },
];

const courseCatalog = [
  {
    slug: 'meditation-foundations',
    title: 'Meditation Foundations',
    category: 'spiritual',
    color: '#F1842D',
    icon: 'sparkles',
    duration: '4 weeks',
    description:
      'A beginner-friendly path into breath awareness, posture, and daily stillness practice.',
    shortDescription: 'Start meditating with simple guided practice.',
    tags: ['beginner', 'meditation', 'focus'],
    includedInPlans: ['bronze', 'copper', 'silver'],
    enrollmentCount: 118,
    completionCount: 56,
    averageRating: 4.7,
    reviewCount: 41,
    videos: [
      ['Welcome to Stillness', 12],
      ['Posture and Breath', 18],
      ['Creating a Daily Routine', 16],
    ],
    pdfs: ['7-day meditation tracker'],
  },
  {
    slug: 'mindful-mornings',
    title: 'Mindful Mornings',
    category: 'mental',
    color: '#F5A35C',
    icon: 'sunny',
    duration: '21 days',
    description:
      'Build a grounded morning rhythm with intention setting, journaling, and short mindfulness rituals.',
    shortDescription: 'A calm and focused start to the day.',
    tags: ['mindfulness', 'routine', 'beginner'],
    includedInPlans: ['copper', 'silver'],
    enrollmentCount: 92,
    completionCount: 38,
    averageRating: 4.6,
    reviewCount: 27,
    videos: [
      ['Morning reset', 10],
      ['Mindful tea ritual', 14],
      ['Intentional journaling', 11],
    ],
    pdfs: ['Morning ritual checklist'],
  },
  {
    slug: 'stress-release-breathwork',
    title: 'Stress Release Breathwork',
    category: 'mental',
    color: '#D97A2B',
    icon: 'leaf',
    duration: '2 weeks',
    description:
      'Use breathwork sequences to release stress, calm the nervous system, and recover focus.',
    shortDescription: 'Short breathwork routines for calmer days.',
    tags: ['breathwork', 'stress', 'anxiety'],
    includedInPlans: ['bronze', 'copper', 'silver'],
    enrollmentCount: 133,
    completionCount: 77,
    averageRating: 4.8,
    reviewCount: 62,
    videos: [
      ['Calming breath basics', 9],
      ['Energy balancing sequence', 15],
      ['Stress reset routine', 13],
    ],
    pdfs: ['Breath pacing reference'],
  },
  {
    slug: 'scripture-for-daily-life',
    title: 'Scripture for Daily Life',
    category: 'spiritual',
    color: '#C7671E',
    icon: 'book',
    duration: '6 weeks',
    description:
      'Understand practical wisdom from spiritual teachings and apply them to daily relationships and choices.',
    shortDescription: 'Spiritual wisdom made practical.',
    tags: ['scripture', 'reflection', 'intermediate'],
    includedInPlans: ['silver'],
    enrollmentCount: 49,
    completionCount: 21,
    averageRating: 4.9,
    reviewCount: 18,
    videos: [
      ['Living with awareness', 24],
      ['Service and detachment', 28],
      ['Meaningful action', 22],
    ],
    pdfs: ['Reflection journal prompts'],
  },
  {
    slug: 'healing-sleep-rituals',
    title: 'Healing Sleep Rituals',
    category: 'physical',
    color: '#E7A86A',
    icon: 'moon',
    duration: '10 days',
    description:
      'Improve sleep quality with evening rituals, body relaxation, and gentle nervous system downshifting.',
    shortDescription: 'Sleep better with mindful evening practices.',
    tags: ['sleep', 'recovery', 'wellness'],
    includedInPlans: ['bronze', 'copper', 'silver'],
    enrollmentCount: 140,
    completionCount: 81,
    averageRating: 4.8,
    reviewCount: 59,
    videos: [
      ['Evening unwind', 8],
      ['Body scan for sleep', 14],
      ['Quieting the mind', 12],
    ],
    pdfs: ['Sleep journal'],
  },
  {
    slug: 'chakra-balance-basics',
    title: 'Chakra Balance Basics',
    category: 'spiritual',
    color: '#CC8447',
    icon: 'color-filter',
    duration: '5 weeks',
    description:
      'Explore chakra awareness through guided meditation, mantra, and subtle energy reflection.',
    shortDescription: 'A grounded introduction to chakra work.',
    tags: ['chakra', 'energy', 'guided'],
    includedInPlans: ['copper', 'silver'],
    enrollmentCount: 65,
    completionCount: 23,
    averageRating: 4.5,
    reviewCount: 16,
    videos: [
      ['Root and grounding', 17],
      ['Heart and openness', 19],
      ['Crown and silence', 18],
    ],
    pdfs: ['Chakra reflection worksheet'],
  },
  {
    slug: 'focus-in-the-digital-age',
    title: 'Focus in the Digital Age',
    category: 'mental',
    color: '#B96524',
    icon: 'bulb',
    duration: '3 weeks',
    description:
      'Train attention, reduce distraction, and rebuild concentration in a notification-heavy lifestyle.',
    shortDescription: 'Sharper attention for modern life.',
    tags: ['focus', 'productivity', 'mindfulness'],
    includedInPlans: ['copper', 'silver'],
    enrollmentCount: 72,
    completionCount: 34,
    averageRating: 4.6,
    reviewCount: 19,
    videos: [
      ['Attention audit', 13],
      ['Single-task focus', 15],
      ['Deep work blocks', 17],
    ],
    pdfs: ['Distraction reset planner'],
  },
  {
    slug: 'gratitude-and-inner-joy',
    title: 'Gratitude and Inner Joy',
    category: 'relationship',
    color: '#F0B27A',
    icon: 'heart',
    duration: '14 days',
    description:
      'Cultivate gratitude, appreciation, and uplifting reflection to improve emotional steadiness.',
    shortDescription: 'A practical gratitude reset.',
    tags: ['gratitude', 'joy', 'reflection'],
    includedInPlans: ['bronze', 'copper', 'silver'],
    enrollmentCount: 88,
    completionCount: 46,
    averageRating: 4.7,
    reviewCount: 29,
    videos: [
      ['The gratitude lens', 9],
      ['Appreciation in relationships', 12],
      ['Anchoring joy', 10],
    ],
    pdfs: ['Daily gratitude prompts'],
  },
];

const podcastCatalog = [
  {
    title: 'Morning Mantra Reset',
    description: 'A short guided mantra session to create clarity and steadiness before the day begins.',
    host: 'ParamSukh Audio',
    source: 'youtube',
    youtubeUrl: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
    duration: '14:22',
    category: 'Meditation',
  },
  {
    title: 'Wisdom for Difficult Days',
    description: 'A practical discourse on how to respond to stressful situations with awareness and compassion.',
    host: 'ParamSukh Audio',
    source: 'youtube',
    youtubeUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    thumbnailUrl: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800',
    duration: '28:10',
    category: 'Discourse',
  },
  {
    title: 'Scripture and Stillness',
    description: 'A reflective audio session connecting scripture study with everyday mindfulness.',
    host: 'ParamSukh Audio',
    source: 'local',
    videoUrl: 'https://example.com/audio/scripture-and-stillness.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
    duration: '22:08',
    category: 'Scripture',
    accessType: 'membership',
  },
  {
    title: 'Healing Breath for Sleep',
    description: 'A calming nighttime audio practice that helps you release tension and prepare for rest.',
    host: 'ParamSukh Audio',
    source: 'local',
    videoUrl: 'https://example.com/audio/healing-breath-for-sleep.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511296265581-c2450046447d?w=800',
    duration: '18:45',
    category: 'Mindfulness',
    accessType: 'membership',
  },
  {
    title: 'Sacred Sound Journey',
    description: 'A premium-length mantra immersion designed for deeper spiritual focus and inner quiet.',
    host: 'ParamSukh Audio',
    source: 'local',
    videoUrl: 'https://example.com/audio/sacred-sound-journey.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
    duration: '41:15',
    category: 'Mantra',
    accessType: 'paid',
    price: 199,
  },
];

const eventCatalog = [
  {
    title: 'Sunrise Meditation Circle',
    category: 'Meditation',
    locationType: 'online',
    location: 'Zoom',
    daysFromNow: 5,
    startHour: 6,
    durationHours: 1,
    isPaid: false,
    registrationRequired: true,
    organizer: 'ParamSukh Guides',
    shortDescription: 'A live guided meditation for beginners and returning practitioners.',
    description:
      'Join a supportive morning meditation circle with breath awareness, silence, and practical guidance for building consistency.',
    tags: ['beginner', 'meditation', 'live'],
    color: '#F1842D',
    icon: 'sunny',
    emoji: '☀️',
  },
  {
    title: 'Inner Peace Weekend Retreat',
    category: 'Retreat',
    locationType: 'physical',
    location: 'Rishikesh Wellness Center',
    daysFromNow: 14,
    startHour: 8,
    durationHours: 8,
    isPaid: true,
    price: 2499,
    earlyBirdPrice: 1999,
    earlyBirdOffsetDays: 7,
    registrationRequired: true,
    organizer: 'ParamSukh Retreat Team',
    shortDescription: 'A one-day immersive retreat focused on silence, movement, and guided reflection.',
    description:
      'Experience a structured day of meditation, restorative movement, journaling, and group practice in a peaceful retreat space.',
    tags: ['retreat', 'spiritual', 'premium'],
    color: '#D97A2B',
    icon: 'leaf',
    emoji: '🍃',
  },
  {
    title: 'Mindful Parenting Q&A',
    category: 'Workshop',
    locationType: 'online',
    location: 'Google Meet',
    daysFromNow: 9,
    startHour: 19,
    durationHours: 2,
    isPaid: false,
    registrationRequired: true,
    organizer: 'ParamSukh Family Circle',
    shortDescription: 'Practical mindfulness tools for calmer and more connected parenting.',
    description:
      'An interactive session with examples, reflection prompts, and supportive Q&A around presence in family life.',
    tags: ['family', 'mindfulness', 'q&a'],
    color: '#E7A86A',
    icon: 'people',
    emoji: '👨‍👩‍👧',
  },
  {
    title: 'Scripture Reflection Evening',
    category: 'Discourse',
    locationType: 'hybrid',
    location: 'ParamSukh Hall, Delhi + Live Stream',
    daysFromNow: 21,
    startHour: 18,
    durationHours: 2,
    isPaid: false,
    registrationRequired: true,
    organizer: 'ParamSukh Teachers',
    shortDescription: 'A reflective discourse connecting timeless teachings to modern challenges.',
    description:
      'Explore selected teachings, group contemplation, and practical application for daily inner steadiness.',
    tags: ['scripture', 'reflection', 'hybrid'],
    color: '#C7671E',
    icon: 'book',
    emoji: '📖',
  },
  {
    title: 'Breathwork for Emotional Reset',
    category: 'Workshop',
    locationType: 'online',
    location: 'Zoom',
    daysFromNow: -10,
    startHour: 18,
    durationHours: 1,
    isPaid: false,
    registrationRequired: true,
    organizer: 'ParamSukh Breath Team',
    shortDescription: 'A recorded workshop on practical breathwork for stress release.',
    description:
      'This recent session covered guided breathing, grounding, and recovery practices for emotionally heavy days.',
    tags: ['breathwork', 'stress', 'recorded'],
    color: '#B96524',
    icon: 'water',
    emoji: '🌬️',
  },
];

const buildSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const createVideoItems = (items) =>
  items.map(([title, minutes], index) => ({
    title,
    description: `${title} lesson for guided learning and steady progress.`,
    videoUrl: `https://example.com/courses/${buildSlug(title)}.mp4`,
    duration: `${minutes}:00`,
    durationInSeconds: minutes * 60,
    thumbnailUrl: `https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&sig=${index + 1}`,
    order: index + 1,
    isFree: index === 0,
  }));

const createPdfItems = (items) =>
  items.map((title, index) => ({
    title,
    description: `${title} for continued reflection and practice.`,
    pdfUrl: `https://example.com/resources/${buildSlug(title)}.pdf`,
    fileSize: `${index + 1}.2 MB`,
    order: index + 1,
    isFree: index === 0,
    thumbnailUrl: null,
  }));

const buildCoursePayload = (course) => ({
  title: course.title,
  slug: course.slug,
  description: course.description,
  shortDescription: course.shortDescription,
  icon: course.icon,
  color: course.color,
  thumbnailUrl: `https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&sig=${course.slug}`,
  bannerUrl: `https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1400&sig=${course.slug}`,
  duration: course.duration,
  strictVideoOrder: false,
  videos: createVideoItems(course.videos),
  pdfs: createPdfItems(course.pdfs),
  liveSessions: [],
  assignments: [],
  category: course.category,
  tags: course.tags,
  includedInPlans: course.includedInPlans,
  status: 'published',
  publishedAt: new Date(),
  enrollmentCount: course.enrollmentCount,
  completionCount: course.completionCount,
  averageRating: course.averageRating,
  reviewCount: course.reviewCount,
  metaTitle: `${course.title} | ParamSukh`,
  metaDescription: course.shortDescription,
});

const buildEventPayload = (event) => {
  const startTime = new Date(Date.now() + event.daysFromNow * DAY_MS);
  startTime.setHours(event.startHour, 0, 0, 0);
  const endTime = new Date(startTime.getTime() + event.durationHours * 60 * 60 * 1000);
  const registrationDeadline = new Date(startTime.getTime() - 2 * DAY_MS);
  const earlyBirdEndDate =
    typeof event.earlyBirdOffsetDays === 'number'
      ? new Date(startTime.getTime() - event.earlyBirdOffsetDays * DAY_MS)
      : null;

  return {
    title: event.title,
    slug: buildSlug(event.title),
    description: event.description,
    shortDescription: event.shortDescription,
    icon: event.icon,
    color: event.color,
    emoji: event.emoji,
    thumbnailUrl: `https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200&sig=${buildSlug(event.title)}`,
    bannerUrl: `https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1400&sig=${buildSlug(event.title)}`,
    eventDate: startTime,
    eventTime: startTime.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    startTime,
    endTime,
    timezone: 'Asia/Kolkata',
    location: event.location,
    locationType: event.locationType,
    address:
      event.locationType === 'physical' || event.locationType === 'hybrid'
        ? {
            street: 'Wellness Avenue',
            city: 'Delhi',
            state: 'Delhi',
            zipCode: '110001',
            country: 'India',
          }
        : undefined,
    onlineMeetingLink:
      event.locationType === 'online' || event.locationType === 'hybrid'
        ? `https://meet.paramsukh.test/${buildSlug(event.title)}`
        : null,
    category: event.category,
    tags: event.tags,
    isPaid: event.isPaid,
    price: event.price || 0,
    currency: 'INR',
    earlyBirdPrice: event.earlyBirdPrice || null,
    earlyBirdEndDate,
    maxAttendees: event.isPaid ? 150 : 300,
    registrationRequired: event.registrationRequired,
    registrationDeadline,
    isActive: true,
    organizer: event.organizer,
    requirements: ['Arrive 10 minutes early', 'Keep a notebook handy'],
    whatToBring: event.locationType === 'physical' ? ['Water bottle', 'Comfortable clothing'] : ['Notebook'],
    additionalInfo: 'This event is included in the demo AI test dataset.',
  };
};

const buildPodcastPayload = (podcast, membershipIdsBySlug) => ({
  ...podcast,
  requiredMemberships:
    podcast.accessType === 'membership'
      ? [membershipIdsBySlug.silver || membershipIdsBySlug.copper].filter(Boolean)
      : [],
  currencyCode: 'INR',
});

const ensureMembershipPlans = async () => {
  for (const plan of defaultPlans) {
    await MembershipPlan.findOneAndUpdate(
      { slug: plan.slug },
      { $set: plan },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
};

const syncMembershipPlansWithCourses = async (coursesBySlug) => {
  const plans = await MembershipPlan.find({ slug: { $in: ['bronze', 'copper', 'silver'] } });
  if (plans.length === 0) {
    throw new Error('Membership plans not found. Run seedMembershipPlans first.');
  }

  const courseIdsByPlan = {
    bronze: [],
    copper: [],
    silver: [],
  };

  Object.values(coursesBySlug).forEach((course) => {
    for (const planSlug of course.includedInPlans || []) {
      if (courseIdsByPlan[planSlug]) {
        courseIdsByPlan[planSlug].push(course._id);
      }
    }
  });

  for (const plan of plans) {
    plan.access = {
      ...plan.access?.toObject?.(),
      ...plan.access,
      includedCourseIds: courseIdsByPlan[plan.slug] || [],
    };
    await plan.save();
  }

  return Object.fromEntries(plans.map((plan) => [plan.slug, plan]));
};

const ensureDemoUser = async () => {
  const now = new Date();
  const payload = {
    phone: DEMO_USER_PHONE,
    displayName: 'Test User',
    email: 'testuser@paramsukh.com',
    authProvider: 'phone',
    subscriptionPlan: 'silver',
    subscriptionStatus: 'active',
    subscriptionStartDate: new Date(now.getTime() - 30 * DAY_MS),
    subscriptionEndDate: new Date(now.getTime() + 335 * DAY_MS),
    assessmentCompleted: true,
    assessmentCompletedAt: new Date(now.getTime() - 20 * DAY_MS),
    isActive: true,
    tags: ['meditation', 'beginner', 'sleep'],
  };

  return User.findOneAndUpdate(
    { phone: DEMO_USER_PHONE },
    { $set: payload },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const upsertUserMembership = async (user, plan) => {
  const startDate = new Date(Date.now() - 30 * DAY_MS);
  const endDate = new Date(Date.now() + 335 * DAY_MS);

  await UserMembership.findOneAndUpdate(
    { userId: user._id, 'planSnapshot.slug': plan.slug, status: 'active' },
    {
      $set: {
        userId: user._id,
        planId: plan._id,
        status: 'active',
        source: 'admin_grant',
        startDate,
        endDate,
        autoRenew: true,
        planSnapshot: {
          title: plan.title,
          slug: plan.slug,
          variant: {
            slug: null,
            title: null,
            selectionKey: null,
          },
          pricing: {
            amount: plan.pricing?.oneTime?.amount || 0,
            currency: plan.pricing?.oneTime?.currency || 'INR',
            type: 'one_time',
          },
        },
        payment: {
          provider: 'manual',
          amount: plan.pricing?.oneTime?.amount || 0,
          currency: plan.pricing?.oneTime?.currency || 'INR',
        },
        metadata: {
          seededBy: 'seedDemoAiData',
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const upsertEnrollments = async (user, coursesBySlug) => {
  const enrollmentConfigs = [
    {
      slug: 'meditation-foundations',
      completedVideoIndexes: [0, 1],
      completedPdfIndexes: [0],
      currentVideoIndex: 2,
      progress: null,
    },
    {
      slug: 'healing-sleep-rituals',
      completedVideoIndexes: [0, 1, 2],
      completedPdfIndexes: [0],
      currentVideoIndex: 2,
      progress: null,
    },
    {
      slug: 'mindful-mornings',
      completedVideoIndexes: [0],
      completedPdfIndexes: [],
      currentVideoIndex: 1,
      progress: null,
    },
  ];

  for (const config of enrollmentConfigs) {
    const course = coursesBySlug[config.slug];
    if (!course) {
      continue;
    }

    const completedVideos = config.completedVideoIndexes
      .map((index) => course.videos?.[index]?._id)
      .filter(Boolean);
    const completedPdfs = config.completedPdfIndexes
      .map((index) => course.pdfs?.[index]?._id)
      .filter(Boolean);

    const enrollment = await Enrollment.findOneAndUpdate(
      { userId: user._id, courseId: course._id },
      {
        $set: {
          userId: user._id,
          courseId: course._id,
          completedVideos,
          completedPdfs,
          currentVideoIndex: config.currentVideoIndex,
          currentVideoId: course.videos?.[config.currentVideoIndex]?._id || course.videos?.[0]?._id || null,
          lastAccessedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    enrollment.updateProgress(course.totalVideos || course.videos.length, course.totalPdfs || course.pdfs.length);
    await enrollment.save();
  }
};

const upsertEventRegistrations = async (user, eventsBySlug) => {
  const targetSlugs = ['sunrise-meditation-circle', 'inner-peace-weekend-retreat'];

  for (const slug of targetSlugs) {
    const event = eventsBySlug[slug];
    if (!event) {
      continue;
    }

    const paymentCompleted = !!event.isPaid;

    await EventRegistration.findOneAndUpdate(
      { userId: user._id, eventId: event._id },
      {
        $set: {
          userId: user._id,
          eventId: event._id,
          status: 'confirmed',
          paymentStatus: paymentCompleted ? 'completed' : 'pending',
          paymentAmount: paymentCompleted ? event.getCurrentPrice() : 0,
          paidAt: paymentCompleted ? new Date() : null,
          participantName: user.displayName,
          participantEmail: user.email || null,
          participantPhone: user.phone,
          notes: 'Demo AI seed registration',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    event.currentAttendees = await EventRegistration.countDocuments({
      eventId: event._id,
      status: { $in: ['confirmed', 'attended'] },
    });
    await event.save();
  }
};

const seedDemoAiData = async () => {
  try {
    await connectDatabase();

    const user = await ensureDemoUser();
    await ensureMembershipPlans();

    const courseDocs = {};
    for (const course of courseCatalog) {
      const saved = await Course.findOneAndUpdate(
        { slug: course.slug },
        { $set: buildCoursePayload(course) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      courseDocs[course.slug] = saved;
    }

    const plansBySlug = await syncMembershipPlansWithCourses(courseDocs);
    await upsertUserMembership(user, plansBySlug.silver);

    const membershipIdsBySlug = Object.fromEntries(
      Object.values(plansBySlug).map((plan) => [plan.slug, plan._id])
    );

    for (const podcast of podcastCatalog) {
      const payload = buildPodcastPayload(podcast, membershipIdsBySlug);
      await Podcast.findOneAndUpdate(
        { title: podcast.title },
        { $set: payload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const eventDocs = {};
    for (const event of eventCatalog) {
      const payload = buildEventPayload(event);
      const saved = await Event.findOneAndUpdate(
        { slug: payload.slug },
        { $set: payload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      eventDocs[payload.slug] = saved;
    }

    await upsertEnrollments(user, courseDocs);
    await upsertEventRegistrations(user, eventDocs);

    const summary = {
      user: {
        phone: user.phone,
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
      },
      courses: await Course.countDocuments({ status: 'published' }),
      podcasts: await Podcast.countDocuments({}),
      events: await Event.countDocuments({ isActive: true }),
      enrollments: await Enrollment.countDocuments({ userId: user._id }),
      registrations: await EventRegistration.countDocuments({ userId: user._id }),
      memberships: await MembershipPlan.countDocuments({ status: 'published' }),
    };

    console.log('Demo AI dataset seeded successfully.');
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed demo AI dataset:', error);
    process.exit(1);
  }
};

seedDemoAiData();
