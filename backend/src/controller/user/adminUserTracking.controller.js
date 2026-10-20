import { User } from '../../models/user.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { EventRegistration } from '../../models/eventRegistration.models.js';
import Certificate from '../../models/certificate.models.js';
import { WellnessGoal } from '../../models/wellnessGoal.models.js';
import { Post, Comment } from '../../models/community.models.js';
import { CommunityPointEvent } from '../../models/communityPoint.models.js';
import { buildUserAnalytics } from './analytics.controller.js';
import { getAchievementCatalog, unlockBadgesForUser } from '../../services/badgeUnlockingService.js';

const DAY_MS = 86400000;
const parseRangeDays = (value, fallback = 30) => {
  const parsed = parseInt(value, 10);
  return [7, 30, 90, 180, 365].includes(parsed) ? parsed : fallback;
};

const toTime = (value) => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
};

const daysSince = (value) => {
  const time = toTime(value);
  if (!time) return null;
  return Math.floor((Date.now() - time) / DAY_MS);
};

const getLastActivityAt = async (userId, user) => {
  const [enrollment, eventRegistration, communityEvent, goal, certificate] = await Promise.all([
    Enrollment.findOne({ userId, lastAccessedAt: { $ne: null } })
      .sort({ lastAccessedAt: -1 })
      .select('lastAccessedAt')
      .lean(),
    EventRegistration.findOne({ userId, status: { $ne: 'cancelled' } })
      .sort({ registeredAt: -1 })
      .select('registeredAt')
      .lean(),
    CommunityPointEvent.findOne({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean(),
    WellnessGoal.findOne({ userId })
      .sort({ updatedAt: -1 })
      .select('updatedAt lastProgressAt completedAt')
      .lean(),
    Certificate.findOne({ user: userId, isRevoked: false })
      .sort({ issuedAt: -1 })
      .select('issuedAt')
      .lean(),
  ]);

  const candidates = [
    user?.lastLoginAt,
    enrollment?.lastAccessedAt,
    eventRegistration?.registeredAt,
    communityEvent?.createdAt,
    goal?.lastProgressAt || goal?.updatedAt || goal?.completedAt,
    certificate?.issuedAt,
  ]
    .map(toTime)
    .filter((time) => time !== null);

  if (!candidates.length) {
    return user?.createdAt ? new Date(user.createdAt).toISOString() : null;
  }
  return new Date(Math.max(...candidates)).toISOString();
};

const buildRisk = (analytics, lastActivityAt) => {
  const now = Date.now();
  const lastActivityTime = toTime(lastActivityAt) || toTime(analytics.profile.memberSince);
  const inactiveDays = lastActivityTime ? Math.floor((now - lastActivityTime) / DAY_MS) : null;

  const stalledCourses = analytics.courses.filter((course) => {
    if (course.isCompleted || course.progress <= 0) return false;
    const lastAccess = toTime(course.lastAccessedAt);
    return lastAccess !== null && (now - lastAccess) > 14 * DAY_MS;
  });

  const notStartedCourses = analytics.courses.filter((course) => {
    if (course.isCompleted || course.progress > 0) return false;
    const enrolledAt = toTime(course.enrolledAt);
    return enrolledAt !== null && (now - enrolledAt) > 14 * DAY_MS;
  });

  const overdueGoals = analytics.goals.activeGoals.filter((goal) => {
    const target = toTime(goal.targetDate);
    return target !== null && target < now;
  });

  const flags = [];
  if (analytics.profile.isActive === false) flags.push('account_inactive');
  if (inactiveDays !== null && inactiveDays >= 30) flags.push('inactive_30d');
  else if (inactiveDays !== null && inactiveDays >= 14) flags.push('inactive_14d');
  if (stalledCourses.length > 0) flags.push('stalled_courses');
  if (notStartedCourses.length > 0) flags.push('not_started_courses');
  if (overdueGoals.length > 0) flags.push('overdue_goals');
  if (analytics.goals.total === 0) flags.push('no_goals');
  if (analytics.learning.totalEnrollments === 0) flags.push('no_enrollments');

  const riskFlags = new Set([
    'account_inactive',
    'inactive_30d',
    'inactive_14d',
    'stalled_courses',
    'not_started_courses',
    'overdue_goals',
  ]);
  const hasRisk = flags.some((flag) => riskFlags.has(flag));
  const riskStatus = (analytics.profile.isActive === false || flags.includes('inactive_30d'))
    ? 'inactive'
    : hasRisk
      ? 'at_risk'
      : 'active';

  return {
    riskStatus,
    flags,
    lastActivityAt,
    inactiveDays,
    stalledCourses: stalledCourses.map((course) => ({
      courseId: course.courseId,
      title: course.title,
      progress: course.progress,
      lastAccessedAt: course.lastAccessedAt,
    })),
    notStartedCourses: notStartedCourses.map((course) => ({
      courseId: course.courseId,
      title: course.title,
      enrolledAt: course.enrolledAt,
    })),
    overdueGoals,
  };
};

/**
 * Admin: full analytics for a specific user.
 * GET /api/user/:userId/analytics/admin?range=30
 */
export const getUserAnalyticsAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const rangeDays = parseRangeDays(req.query.range, 30);

    const analytics = await buildUserAnalytics({ userId, rangeDays });
    if (!analytics) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = await User.findById(userId)
      .select('displayName email phone photoURL subscriptionPlan subscriptionStatus isActive lastLoginAt createdAt')
      .lean();

    const [lastActivityAt, achievementCatalog] = await Promise.all([
      getLastActivityAt(userId, user),
      (async () => {
        await unlockBadgesForUser(userId);
        return getAchievementCatalog(userId);
      })(),
    ]);

    const risk = buildRisk(analytics, lastActivityAt);

    return res.status(200).json({
      success: true,
      ...analytics,
      overview: {
        ...analytics.overview,
        lastActivityAt,
      },
      risk,
      achievements: achievementCatalog?.badges || [],
      achievementStats: achievementCatalog?.stats || null,
    });
  } catch (error) {
    console.error('Get Admin User Analytics Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load user analytics',
      error: error.message,
    });
  }
};

const buildActivityFeed = async (userId, rangeDays) => {
  const start = new Date(Date.now() - rangeDays * DAY_MS);

  const [user, enrollments, eventRegistrations, certificates, goals, pointEvents, posts, comments] = await Promise.all([
    User.findById(userId).select('createdAt lastLoginAt displayName').lean(),
    Enrollment.find({ userId })
      .populate('courseId', 'title')
      .lean(),
    EventRegistration.find({ userId })
      .populate('eventId', 'title eventDate')
      .lean(),
    Certificate.find({ user: userId, isRevoked: false }).lean(),
    WellnessGoal.find({ userId }).lean(),
    CommunityPointEvent.find({ userId, isActive: true, createdAt: { $gte: start } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Post.find({ userId, isActive: true, createdAt: { $gte: start } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Comment.find({ userId, isActive: true, createdAt: { $gte: start } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);

  if (!user) return null;

  const activities = [];
  const add = (type, title, description, date, metadata = {}) => {
    const timestamp = toTime(date);
    if (!timestamp || timestamp < start.getTime()) return;
    activities.push({ type, title, description, date: new Date(timestamp).toISOString(), metadata });
  };

  add('account_created', 'Account created', `${user.displayName || 'User'} joined ParamSukh`, user.createdAt);
  add('login', 'Logged in', 'Most recent login', user.lastLoginAt);

  enrollments.forEach((enrollment) => {
    const courseTitle = enrollment.courseId?.title || 'Course';
    add('course_enrolled', 'Enrolled in course', courseTitle, enrollment.enrolledAt, {
      courseId: enrollment.courseId?._id || enrollment.courseId,
      progress: enrollment.progress,
    });
    add('course_progress', 'Course activity', `${courseTitle} · ${enrollment.progress || 0}% complete`, enrollment.lastAccessedAt, {
      courseId: enrollment.courseId?._id || enrollment.courseId,
      progress: enrollment.progress,
    });
    if (enrollment.isCompleted) {
      add('course_completed', 'Completed course', courseTitle, enrollment.completedAt, {
        courseId: enrollment.courseId?._id || enrollment.courseId,
      });
    }
  });

  eventRegistrations.forEach((registration) => {
    const eventTitle = registration.eventId?.title || 'Event';
    add('event_registered', 'Registered for event', eventTitle, registration.registeredAt, {
      eventId: registration.eventId?._id || registration.eventId,
      status: registration.status,
    });
    if (registration.status === 'attended') {
      add('event_attended', 'Attended event', eventTitle, registration.checkedInAt || registration.updatedAt, {
        eventId: registration.eventId?._id || registration.eventId,
      });
    }
  });

  certificates.forEach((certificate) => {
    add('certificate_issued', 'Certificate issued', certificate.courseName, certificate.issuedAt, {
      certificateId: certificate.certificateId,
    });
  });

  goals.forEach((goal) => {
    add('goal_created', 'Wellness goal created', goal.title, goal.createdAt, {
      goalId: goal._id,
      category: goal.category,
    });
    add('goal_progress', 'Wellness goal updated', `${goal.title} · ${goal.currentValue || 0}/${goal.targetValue}`, goal.lastProgressAt || goal.updatedAt, {
      goalId: goal._id,
      status: goal.status,
    });
    if (goal.status === 'completed') {
      add('goal_completed', 'Wellness goal completed', goal.title, goal.completedAt, {
        goalId: goal._id,
      });
    }
  });

  pointEvents.forEach((event) => {
    add('community_points', 'Community activity', `${event.action.replace(/_/g, ' ')} · +${event.points}`, event.createdAt, {
      action: event.action,
      points: event.points,
      groupId: event.groupId,
    });
  });

  posts.forEach((post) => {
    add('community_post', 'Created a community post', (post.title || post.content || '').slice(0, 120), post.createdAt, {
      postId: post._id,
    });
  });

  comments.forEach((comment) => {
    add('community_comment', 'Commented in the community', (comment.content || '').slice(0, 120), comment.createdAt, {
      commentId: comment._id,
      postId: comment.postId,
    });
  });

  activities.sort((a, b) => new Date(b.date) - new Date(a.date));

  return activities.slice(0, 200);
};

/**
 * Admin: activity timeline for a user.
 * GET /api/user/:userId/activity?range=90
 */
export const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const rangeDays = parseRangeDays(req.query.range, 90);

    const activities = await buildActivityFeed(userId, rangeDays);
    if (!activities) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      rangeDays,
      activities,
      total: activities.length,
    });
  } catch (error) {
    console.error('Get Admin User Activity Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load user activity',
      error: error.message,
    });
  }
};

const emptyLastActivityMap = () => new Map();
const setLatest = (map, userId, date) => {
  const time = toTime(date);
  if (!time) return;
  const key = String(userId);
  const current = map.get(key) || 0;
  if (time > current) map.set(key, time);
};

/**
 * Admin: users needing attention across the platform.
 * GET /api/user/analytics/admin/attention
 */
export const getUsersNeedingAttention = async (req, res) => {
  try {
    const rangeDays = parseRangeDays(req.query.range, 30);
    const stalledCutoff = new Date(Date.now() - 14 * DAY_MS);
    const inactiveCutoff = new Date(Date.now() - rangeDays * DAY_MS);

    const [users, enrollmentActivities, eventActivities, communityActivities, goalActivities, certificateActivities, stalledEnrollments, notStartedEnrollments, overdueGoalDocs] = await Promise.all([
      User.find({})
        .select('displayName email phone subscriptionPlan subscriptionStatus isActive lastLoginAt createdAt')
        .lean(),
      Enrollment.aggregate([{ $match: { lastAccessedAt: { $ne: null } } }, { $group: { _id: '$userId', last: { $max: '$lastAccessedAt' } } }]),
      EventRegistration.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: '$userId', last: { $max: '$registeredAt' } } }]),
      CommunityPointEvent.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$userId', last: { $max: '$createdAt' } } }]),
      WellnessGoal.aggregate([{ $group: { _id: '$userId', last: { $max: '$updatedAt' } } }]),
      Certificate.aggregate([{ $match: { isRevoked: false } }, { $group: { _id: '$user', last: { $max: '$issuedAt' } } }]),
      Enrollment.find({ isCompleted: false, progress: { $gt: 0, $lt: 100 }, lastAccessedAt: { $lt: stalledCutoff } })
        .populate('courseId', 'title')
        .select('userId courseId progress lastAccessedAt')
        .lean(),
      Enrollment.find({ isCompleted: false, progress: 0, enrolledAt: { $lt: stalledCutoff } })
        .populate('courseId', 'title')
        .select('userId courseId enrolledAt')
        .lean(),
      WellnessGoal.find({ status: 'active', targetDate: { $lt: new Date() } })
        .select('userId title targetDate')
        .lean(),
    ]);

    const lastActivityMap = emptyLastActivityMap();
    enrollmentActivities.forEach((item) => setLatest(lastActivityMap, item._id, item.last));
    eventActivities.forEach((item) => setLatest(lastActivityMap, item._id, item.last));
    communityActivities.forEach((item) => setLatest(lastActivityMap, item._id, item.last));
    goalActivities.forEach((item) => setLatest(lastActivityMap, item._id, item.last));
    certificateActivities.forEach((item) => setLatest(lastActivityMap, item._id, item.last));

    const stalledByUser = new Map();
    stalledEnrollments.forEach((enrollment) => {
      const key = String(enrollment.userId);
      const list = stalledByUser.get(key) || [];
      list.push({
        courseId: enrollment.courseId?._id || enrollment.courseId,
        title: enrollment.courseId?.title || 'Course',
        progress: enrollment.progress,
        lastAccessedAt: enrollment.lastAccessedAt,
      });
      stalledByUser.set(key, list);
    });

    const notStartedByUser = new Map();
    notStartedEnrollments.forEach((enrollment) => {
      const key = String(enrollment.userId);
      const list = notStartedByUser.get(key) || [];
      list.push({
        courseId: enrollment.courseId?._id || enrollment.courseId,
        title: enrollment.courseId?.title || 'Course',
        enrolledAt: enrollment.enrolledAt,
      });
      notStartedByUser.set(key, list);
    });

    const overdueByUser = new Map();
    overdueGoalDocs.forEach((goal) => {
      const key = String(goal.userId);
      const list = overdueByUser.get(key) || [];
      list.push({
        goalId: goal._id,
        title: goal.title,
        targetDate: goal.targetDate,
      });
      overdueByUser.set(key, list);
    });

    const summaries = users.map((user) => {
      const key = String(user._id);
      const eventActivityTime = Math.max(
        lastActivityMap.get(key) || 0,
        toTime(user.lastLoginAt) || 0,
      );
      const activityTime = eventActivityTime || toTime(user.createdAt) || 0;
      const lastActivityAt = activityTime ? new Date(activityTime).toISOString() : null;
      const inactiveDays = activityTime
        ? Math.floor((Date.now() - activityTime) / DAY_MS)
        : null;
      const stalledCourses = stalledByUser.get(key) || [];
      const notStartedCourses = notStartedByUser.get(key) || [];
      const overdueGoals = overdueByUser.get(key) || [];

      const flags = [];
      if (user.isActive === false) flags.push('account_inactive');
      if (inactiveDays !== null && inactiveDays >= 30) flags.push('inactive_30d');
      else if (inactiveDays !== null && inactiveDays >= 14) flags.push('inactive_14d');
      if (stalledCourses.length > 0) flags.push('stalled_courses');
      if (notStartedCourses.length > 0) flags.push('not_started_courses');
      if (overdueGoals.length > 0) flags.push('overdue_goals');

      const riskStatus = (user.isActive === false || flags.includes('inactive_30d'))
        ? 'inactive'
        : flags.length > 0
          ? 'at_risk'
          : 'active';

      return {
        userId: user._id,
        displayName: user.displayName || 'Unnamed user',
        email: user.email || null,
        phone: user.phone || null,
        plan: user.subscriptionPlan || 'free',
        subscriptionStatus: user.subscriptionStatus || 'inactive',
        isActive: user.isActive !== false,
        lastActivityAt,
        inactiveDays,
        riskStatus,
        flags,
        stalledCourses,
        notStartedCourses,
        overdueGoals,
      };
    });

    const counts = {
      total: summaries.length,
      active: summaries.filter((item) => item.riskStatus === 'active').length,
      atRisk: summaries.filter((item) => item.riskStatus === 'at_risk').length,
      inactive: summaries.filter((item) => item.riskStatus === 'inactive').length,
      stalled: summaries.filter((item) => item.flags.includes('stalled_courses')).length,
      overdueGoals: summaries.filter((item) => item.flags.includes('overdue_goals')).length,
      inactiveCutoff: inactiveCutoff.toISOString(),
    };

    const severity = (item) => {
      if (item.riskStatus === 'inactive') return 0;
      if (item.flags.includes('overdue_goals')) return 1;
      if (item.flags.includes('stalled_courses')) return 2;
      if (item.flags.includes('not_started_courses')) return 3;
      if (item.flags.includes('inactive_14d')) return 4;
      return 5;
    };

    const top = [...summaries]
      .filter((item) => item.riskStatus !== 'active')
      .sort((a, b) => {
        const severityDiff = severity(a) - severity(b);
        if (severityDiff !== 0) return severityDiff;
        return (b.inactiveDays || 0) - (a.inactiveDays || 0);
      })
      .slice(0, 12);

    return res.status(200).json({
      success: true,
      rangeDays,
      counts,
      top,
      users: summaries.map((item) => ({
        userId: item.userId,
        lastActivityAt: item.lastActivityAt,
        inactiveDays: item.inactiveDays,
        riskStatus: item.riskStatus,
        flags: item.flags,
      })),
    });
  } catch (error) {
    console.error('Get Users Needing Attention Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load users needing attention',
      error: error.message,
    });
  }
};
