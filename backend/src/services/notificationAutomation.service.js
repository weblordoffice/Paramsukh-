import cron from 'node-cron';
import Notification from '../models/notification.models.js';
import { User } from '../models/user.models.js';
import { WellnessGoal } from '../models/wellnessGoal.models.js';
import Assessment from '../models/assessment.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { Course } from '../models/course.models.js';
import PodcastFavorite from '../models/podcastFavorite.model.js';
import Podcast from '../models/podcast.model.js';
import { sendBulkNotifications } from '../controller/notifications/notifications.controller.js';

const DEFAULT_DAILY_QUOTE_CRON = '0 8 * * *';
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const MOTIVATION_QUOTES = [
  { text: 'The mind is everything. What you think you become.', author: 'Buddha' },
  { text: 'Peace comes from within. Do not seek it without.', author: 'Buddha' },
  { text: 'Your calm mind is the ultimate weapon against your challenges.', author: 'Bryant McGill' },
  { text: 'Breath is the bridge which connects life to consciousness.', author: 'Thich Nhat Hanh' },
  { text: 'Health is a state of complete harmony of body, mind, and spirit.', author: 'B.K.S. Iyengar' },
  { text: 'The journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'You are the sky. Everything else is just the weather.', author: 'Pema Chödrön' },
  { text: 'Almost everything will work again if you unplug it for a few minutes, including you.', author: 'Anne Lamott' },
  { text: 'Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.', author: 'Thich Nhat Hanh' },
  { text: 'The greatest wealth is health.', author: 'Virgil' },
  { text: 'Quiet the mind, and the soul will speak.', author: 'Ma Jaya Sati Bhagavati' },
  { text: 'Every morning we are born again. What we do today matters most.', author: 'Buddha' },
  { text: 'Within you, there is a stillness and a sanctuary you can retreat to at any time.', author: 'Hermann Hesse' },
  { text: 'Wellness is the complete integration of body, mind, and spirit.', author: 'Greg Anderson' },
  { text: 'Wherever you go, there you are.', author: 'Jon Kabat-Zinn' },
  { text: 'The best way to capture moments is to pay attention.', author: 'Jon Kabat-Zinn' },
  { text: 'Take care of your body. It is the only place you have to live.', author: 'Jim Rohn' },
  { text: 'In the midst of movement and chaos, keep stillness inside of you.', author: 'Deepak Chopra' },
  { text: 'Happiness is not something ready made. It comes from your own actions.', author: 'Dalai Lama' },
  { text: 'Silence is not an absence of sound but a presence of awareness.', author: 'Unknown' },
  { text: 'Small daily improvements over time lead to stunning results.', author: 'Robin Sharma' },
  { text: 'The soul always knows what to do to heal itself. The challenge is to silence the mind.', author: 'Caroline Myss' },
  { text: 'You cannot always control what goes on outside. But you can always control what goes on inside.', author: 'Wayne Dyer' },
  { text: 'Rest is not idleness; it is the sweet sauce of labor.', author: 'Plutarch' },
  { text: 'Let your breath be your anchor today.', author: 'ParamSukh' },
  { text: 'Balance is not something you find; it is something you create.', author: 'Jana Kingsford' },
  { text: 'A calm and modest life brings more happiness than the pursuit of success combined with constant restlessness.', author: 'Albert Einstein' },
  { text: 'Nourish your body, mind, and soul with kindness today.', author: 'ParamSukh' },
  { text: 'The present moment is the only moment available to us, and it is the door to all moments.', author: 'Thich Nhat Hanh' },
  { text: 'Begin where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
];

const CATEGORY_TAG_RULES = [
  { tag: 'mental', match: /mental|mind|mindful|meditat|stress|anxiety|sleep|focus/i },
  { tag: 'emotional', match: /emotion|mood|grief|heart|relationship|family/i },
  { tag: 'physical', match: /physical|body|health|fitness|yoga|nutrition|diet|exercise/i },
  { tag: 'spiritual', match: /spiritual|soul|scripture|mantra|discourse|devotion|meditat/i },
  { tag: 'financial', match: /financ|money|wealth|abundance/i },
  { tag: 'relationship', match: /relationship|family|marriage|parent|love/i },
  { tag: 'lifestyle', match: /lifestyle|habit|routine|balance|wellness/i },
];

const normalizeText = (value) => String(value || '').trim();

export const interestTagsFromText = (...values) => {
  const text = values.map(normalizeText).join(' ');
  if (!text) return [];
  const tags = new Set();
  for (const rule of CATEGORY_TAG_RULES) {
    if (rule.match.test(text)) tags.add(rule.tag);
  }
  return [...tags];
};

const notificationUserQuery = (ids) => ({
  _id: { $in: ids },
  isActive: true,
  'preferences.notifications': { $ne: false },
});

const findActiveUserIds = async () => {
  const users = await User.find({ isActive: true, 'preferences.notifications': { $ne: false } })
    .select('_id')
    .lean();
  return users.map((user) => user._id);
};

const assessmentConditionsForTags = (tags) => {
  const conditions = [];
  if (tags.includes('mental') || tags.includes('emotional')) {
    conditions.push({ mentalHealthIssue: true });
    conditions.push({ stressLevel: { $gte: 7 } });
  }
  if (tags.includes('physical')) {
    conditions.push({ physicalIssue: true });
    conditions.push({ specialDiseaseIssue: true });
  }
  if (tags.includes('spiritual')) {
    conditions.push({ spiritualGrowth: true });
  }
  if (tags.includes('financial')) {
    conditions.push({ financialIssue: true });
  }
  if (tags.includes('relationship')) {
    conditions.push({ relationshipIssue: true });
  }
  return conditions;
};

/**
 * Resolve users whose declared goals, assessment, enrollments, or podcast
 * favorites match the supplied interest tags.
 */
export const resolveInterestedUserIds = async (tags, { fallbackAll = true } = {}) => {
  const uniqueTags = [...new Set((tags || []).filter(Boolean))];
  if (!uniqueTags.length) return findActiveUserIds();

  const ids = new Set();

  const goalUserIds = await WellnessGoal.distinct('userId', {
    status: 'active',
    category: { $in: uniqueTags },
  });
  goalUserIds.forEach((id) => ids.add(String(id)));

  const assessmentConditions = assessmentConditionsForTags(uniqueTags);
  if (assessmentConditions.length) {
    const assessmentUserIds = await Assessment.distinct('user', { $or: assessmentConditions });
    assessmentUserIds.forEach((id) => ids.add(String(id)));
  }

  const enrollments = await Enrollment.find({ status: { $ne: 'cancelled' } })
    .select('userId courseId')
    .lean();
  if (enrollments.length) {
    const courseIds = [...new Set(enrollments.map((item) => String(item.courseId)))];
    const courses = await Course.find({ _id: { $in: courseIds } }).select('category').lean();
    const courseTags = new Map(
      courses.map((course) => [String(course._id), interestTagsFromText(course.category)])
    );
    for (const enrollment of enrollments) {
      const tagsForCourse = courseTags.get(String(enrollment.courseId)) || [];
      if (tagsForCourse.some((tag) => uniqueTags.includes(tag))) {
        ids.add(String(enrollment.userId));
      }
    }
  }

  const favoriteDocs = await PodcastFavorite.find({ 'podcasts.0': { $exists: true } })
    .select('user podcasts')
    .lean();
  if (favoriteDocs.length) {
    const podcastIds = [...new Set(favoriteDocs.flatMap((doc) => doc.podcasts.map((p) => String(p.podcast))))];
    const podcasts = await Podcast.find({ _id: { $in: podcastIds } }).select('category').lean();
    const podcastTags = new Map(
      podcasts.map((podcast) => [String(podcast._id), interestTagsFromText(podcast.category)])
    );
    for (const favorite of favoriteDocs) {
      const matches = favorite.podcasts.some((entry) => {
        const tagsForPodcast = podcastTags.get(String(entry.podcast)) || [];
        return tagsForPodcast.some((tag) => uniqueTags.includes(tag));
      });
      if (matches) ids.add(String(favorite.user));
    }
  }

  if (!ids.size) {
    return fallbackAll ? findActiveUserIds() : [];
  }

  const users = await User.find(notificationUserQuery([...ids])).select('_id').lean();
  return users.map((user) => user._id);
};

const sendToAudience = async (userIds, notificationData) => {
  const uniqueIds = [...new Set((userIds || []).map(String))];
  if (!uniqueIds.length) return 0;
  await sendBulkNotifications(uniqueIds, notificationData);
  return uniqueIds.length;
};

export const notifyNewCourse = async (course) => {
  if (!course || course.status !== 'published') return 0;
  const tags = interestTagsFromText(course.category, course.title, ...(course.tags || []));
  const userIds = await resolveInterestedUserIds(tags);
  return sendToAudience(userIds, {
    type: 'course_update',
    title: `New course: ${course.title}`,
    message: (course.description || 'A new wellness course is now available.').slice(0, 160),
    relatedId: course._id,
    relatedType: 'course',
    icon: '📚',
    priority: 'medium',
  });
};

export const notifyCourseContentAdded = async (course, contentType, contentTitle) => {
  if (!course) return 0;
  const enrolledUserIds = await Enrollment.find({
    courseId: course._id,
    status: { $ne: 'cancelled' },
  }).distinct('userId');
  if (!enrolledUserIds.length) return 0;

  const userIds = await User.find(notificationUserQuery(enrolledUserIds)).select('_id').lean();
  const finalIds = userIds.map((user) => user._id);

  return sendToAudience(finalIds, {
    type: 'course_update',
    title: `New ${contentType} in ${course.title}`,
    message: `"${contentTitle}" was just added to ${course.title}. Continue learning now.`,
    relatedId: course._id,
    relatedType: 'course',
    icon: '✨',
    priority: 'medium',
  });
};

export const notifyNewEvent = async (event) => {
  if (!event || event.status === 'cancelled') return 0;
  const tags = interestTagsFromText(event.category, event.title, ...(event.tags || []));
  const userIds = await resolveInterestedUserIds(tags);
  const dateText = event.eventDate
    ? new Date(event.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return sendToAudience(userIds, {
    type: 'event_created',
    title: `New event: ${event.title}`,
    message: [dateText, event.location].filter(Boolean).join(' • ') || 'A new wellness event is now open for registration.',
    relatedId: event._id,
    relatedType: 'event',
    icon: event.emoji || '📅',
    priority: 'medium',
  });
};

export const notifyNewPodcast = async (podcast) => {
  if (!podcast) return 0;
  const tags = interestTagsFromText(podcast.category, podcast.title, podcast.description);
  const userIds = await resolveInterestedUserIds(tags);

  return sendToAudience(userIds, {
    type: 'podcast_episode',
    title: `New podcast: ${podcast.title}`,
    message: `Listen to "${podcast.title}" by ${podcast.host || 'ParamSukh'}.`,
    relatedId: podcast._id,
    relatedType: 'podcast',
    icon: '🎧',
    priority: 'low',
  });
};

export const notifyNewOffer = async (offer) => {
  if (!offer || offer.isActive === false) return 0;
  const userIds = await findActiveUserIds();

  const discountText = offer.discountType === 'percentage'
    ? `${offer.discountValue}% off`
    : `₹${offer.discountValue} off`;

  return sendToAudience(userIds, {
    type: 'offer_alert',
    title: `New offer: ${offer.title}`,
    message: (offer.description || `${discountText} on the ParamSukh divine shop.`).slice(0, 160),
    icon: '🛍️',
    priority: 'medium',
    actionUrl: '/(home)/offers',
  });
};

export const sendDailyMotivationQuotes = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const alreadyNotified = await Notification.find({
    type: 'daily_motivation',
    createdAt: { $gte: startOfDay },
  }).distinct('user');

  const users = await User.find({
    isActive: true,
    'preferences.notifications': { $ne: false },
    _id: { $nin: alreadyNotified },
  }).select('_id').lean();

  if (!users.length) return { sent: 0 };

  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % MOTIVATION_QUOTES.length;
  const quote = MOTIVATION_QUOTES[dayIndex];

  const userIds = users.map((user) => user._id);
  await sendBulkNotifications(userIds, {
    type: 'daily_motivation',
    title: 'Daily Motivation',
    message: `"${quote.text}" — ${quote.author}`,
    icon: '🌅',
    priority: 'low',
  });

  return { sent: userIds.length, quote };
};

export const setupNotificationAutomationCrons = () => {
  const schedule = process.env.DAILY_QUOTE_CRON || DEFAULT_DAILY_QUOTE_CRON;
  const timezone = process.env.DAILY_QUOTE_TIMEZONE || DEFAULT_TIMEZONE;

  cron.schedule(schedule, async () => {
    try {
      const result = await sendDailyMotivationQuotes();
      if (result.sent > 0) {
        console.log(`[CRON] Daily motivation sent to ${result.sent} users`);
      }
    } catch (error) {
      console.error('[CRON] Daily motivation failed:', error.message);
    }
  }, { timezone });

  console.log(`[CRON] Daily motivation quotes scheduled (${schedule}, ${timezone})`);
};

export const MOTIVATION_QUOTE_COUNT = MOTIVATION_QUOTES.length;
