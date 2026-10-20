import { User } from '../../models/user.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { EventRegistration } from '../../models/eventRegistration.models.js';
import Certificate from '../../models/certificate.models.js';
import Assessment from '../../models/assessment.models.js';
import { WellnessGoal } from '../../models/wellnessGoal.models.js';
import { Post, Comment } from '../../models/community.models.js';
import { CommunityPointEvent } from '../../models/communityPoint.models.js';

const toDayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const buildDateRange = (rangeDays) => {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (rangeDays - 1));
  start.setUTCHours(0, 0, 0, 0);

  const days = [];
  const cursor = new Date(start);
  while (cursor <= end && days.length < rangeDays) {
    days.push(toDayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { start, end, days };
};

const groupByDay = (items, dateField) => {
  const map = new Map();
  items.forEach((item) => {
    const key = toDayKey(item[dateField]);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
};

const calculateStreak = (activeDays) => {
  if (!activeDays.size) return 0;

  const sorted = [...activeDays].sort().reverse();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayKey = toDayKey(today);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = toDayKey(yesterday);

  if (sorted[0] !== todayKey && sorted[0] !== yesterdayKey) return 0;

  let streak = 0;
  const cursor = new Date(sorted[0]);
  const activeSet = new Set(sorted);

  while (activeSet.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
};

const getGoalProgressPercent = (goal) => {
  const target = Number(goal.targetValue) || 0;
  const current = Number(goal.currentValue) || 0;
  if (target <= 0) return goal.status === 'completed' ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
};

const calculateProfileCompleteness = (user, assessment) => {
  const checks = [
    { key: 'displayName', done: Boolean(user?.displayName) },
    { key: 'phone', done: Boolean(user?.phone) },
    { key: 'email', done: Boolean(user?.email) },
    { key: 'photo', done: Boolean(user?.photoURL) },
    { key: 'age', done: Number(assessment?.age) > 0 },
    { key: 'occupation', done: Boolean(assessment?.occupation) },
    { key: 'location', done: Boolean(assessment?.location) },
    { key: 'wellnessScores', done: ['stressLevel', 'sleepQuality', 'energyLevel', 'moodRating'].every((key) => Number(assessment?.[key]) > 0) },
    {
      key: 'wellnessFocus',
      done: ['physicalIssue', 'specialDiseaseIssue', 'relationshipIssue', 'financialIssue', 'mentalHealthIssue', 'spiritualGrowth']
        .some((key) => assessment?.[key] === true),
    },
  ];

  const completed = checks.filter((item) => item.done).length;
  return {
    percent: Math.round((completed / checks.length) * 100),
    completed,
    total: checks.length,
    missing: checks.filter((item) => !item.done).map((item) => item.key),
  };
};

/**
 * Shared analytics builder used by the user and admin dashboards.
 */
export const buildUserAnalytics = async ({ userId, rangeDays = 30 }) => {
    const normalizedRange = [7, 30, 90, 180, 365].includes(Number(rangeDays)) ? Number(rangeDays) : 30;
    const { start, end, days } = buildDateRange(normalizedRange);

    const streakStart = new Date();
    streakStart.setUTCDate(streakStart.getUTCDate() - 364);
    streakStart.setUTCHours(0, 0, 0, 0);

    const [
      user,
      enrollments,
      assessment,
      certificatesCount,
      eventRegistrations,
      eventsAttended,
      goals,
      communityPointsTotal,
      postsCount,
      commentsCount,
      pointEvents,
      eventRegsInRange,
      certificatesInRange,
      completedGoalsInRange,
      enrollmentsAccessedInRange,
      attendanceInRange,
      communityStreakEvents,
      eventStreakRegistrations,
      certificateStreakItems,
      goalStreakItems,
      enrollmentStreakAccesses,
    ] = await Promise.all([
      User.findById(userId).select('displayName email phone photoURL loginCount createdAt lastLoginAt subscriptionPlan subscriptionStatus isActive').lean(),
      Enrollment.find({ userId })
        .populate('courseId', 'title category thumbnailUrl duration')
        .sort({ lastAccessedAt: -1 })
        .lean(),
      Assessment.findOne({ user: userId }).lean(),
      Certificate.countDocuments({ user: userId, isRevoked: false }),
      EventRegistration.countDocuments({ userId, status: { $ne: 'cancelled' } }),
      EventRegistration.countDocuments({ userId, status: 'attended' }),
      WellnessGoal.find({ userId }).sort({ status: 1, targetDate: 1 }).lean(),
      CommunityPointEvent.aggregate([
        { $match: { userId, isActive: true } },
        { $group: { _id: null, total: { $sum: '$points' } } },
      ]),
      Post.countDocuments({ userId, isActive: true }),
      Comment.countDocuments({ userId, isActive: true }),
      CommunityPointEvent.find({ userId, isActive: true, createdAt: { $gte: start, $lte: end } })
        .select('createdAt')
        .lean(),
      EventRegistration.find({ userId, registeredAt: { $gte: start, $lte: end } })
        .select('registeredAt')
        .lean(),
      Certificate.find({ user: userId, isRevoked: false, issuedAt: { $gte: start, $lte: end } })
        .select('issuedAt')
        .lean(),
      WellnessGoal.find({ userId, status: 'completed', completedAt: { $gte: start, $lte: end } })
        .select('completedAt')
        .lean(),
      Enrollment.find({ userId, lastAccessedAt: { $gte: start, $lte: end } })
        .select('lastAccessedAt')
        .lean(),
      EventRegistration.find({ userId, status: 'attended', updatedAt: { $gte: start, $lte: end } })
        .select('updatedAt')
        .lean(),
      CommunityPointEvent.find({ userId, isActive: true, createdAt: { $gte: streakStart } })
        .select('createdAt')
        .lean(),
      EventRegistration.find({ userId, registeredAt: { $gte: streakStart } })
        .select('registeredAt')
        .lean(),
      Certificate.find({ user: userId, isRevoked: false, issuedAt: { $gte: streakStart } })
        .select('issuedAt')
        .lean(),
      WellnessGoal.find({ userId, status: 'completed', completedAt: { $gte: streakStart } })
        .select('completedAt')
        .lean(),
      Enrollment.find({ userId, lastAccessedAt: { $gte: streakStart } })
        .select('lastAccessedAt')
        .lean(),
    ]);

    if (!user) {
      return null;
    }

    const communityPoints = communityPointsTotal?.[0]?.total || 0;

    const courseProgress = enrollments
      .filter((enrollment) => enrollment.courseId)
      .map((enrollment) => ({
        enrollmentId: enrollment._id,
        courseId: enrollment.courseId._id,
        title: enrollment.courseId.title,
        category: enrollment.courseId.category || null,
        thumbnailUrl: enrollment.courseId.thumbnailUrl || null,
        progress: Number(enrollment.progress) || 0,
        isCompleted: enrollment.isCompleted === true,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        lastAccessedAt: enrollment.lastAccessedAt,
      }));

    const totalEnrollments = courseProgress.length;
    const completedCourses = courseProgress.filter((course) => course.isCompleted).length;
    const averageProgress = totalEnrollments > 0
      ? Math.round(courseProgress.reduce((sum, course) => sum + course.progress, 0) / totalEnrollments)
      : 0;

    const activeGoals = goals
      .filter((goal) => goal.status === 'active')
      .map((goal) => ({
        _id: goal._id,
        title: goal.title,
        category: goal.category,
        currentValue: goal.currentValue,
        targetValue: goal.targetValue,
        unit: goal.unit,
        targetDate: goal.targetDate,
        progressPercent: getGoalProgressPercent(goal),
      }));

    const goalsCompleted = goals.filter((goal) => goal.status === 'completed').length;
    const goalsActive = goals.filter((goal) => goal.status === 'active').length;
    const goalsPaused = goals.filter((goal) => goal.status === 'paused').length;
    const averageGoalProgress = goals.length > 0
      ? Math.round(goals.reduce((sum, goal) => sum + getGoalProgressPercent(goal), 0) / goals.length)
      : 0;

    const wellness = assessment ? {
      stressLevel: assessment.stressLevel,
      sleepQuality: assessment.sleepQuality,
      energyLevel: assessment.energyLevel,
      moodRating: assessment.moodRating,
      physicalActivityLevel: assessment.physicalActivityLevel,
      focusAreas: {
        physical: assessment.physicalIssue === true,
        chronicIllness: assessment.specialDiseaseIssue === true,
        relationship: assessment.relationshipIssue === true,
        financial: assessment.financialIssue === true,
        mental: assessment.mentalHealthIssue === true,
        spiritual: assessment.spiritualGrowth === true,
      },
      wellnessScore: Math.round(
        (((11 - Number(assessment.stressLevel || 5))
          + Number(assessment.sleepQuality || 5)
          + Number(assessment.energyLevel || 5)
          + Number(assessment.moodRating || 5)) / 4) * 10
      ),
      updatedAt: assessment.updatedAt || assessment.completedAt || null,
    } : null;

    const communityByDay = groupByDay(pointEvents, 'createdAt');
    const eventsByDay = groupByDay(eventRegsInRange, 'registeredAt');
    const certificatesByDay = groupByDay(certificatesInRange, 'issuedAt');
    const goalsByDay = groupByDay(completedGoalsInRange, 'completedAt');
    const learningByDay = groupByDay(enrollmentsAccessedInRange, 'lastAccessedAt');
    const attendanceByDay = groupByDay(attendanceInRange, 'updatedAt');

    const trend = days.map((date) => {
      const learning = learningByDay.get(date) || 0;
      const community = communityByDay.get(date) || 0;
      const events = (eventsByDay.get(date) || 0) + (attendanceByDay.get(date) || 0);
      const achievements = (certificatesByDay.get(date) || 0) + (goalsByDay.get(date) || 0);

      return {
        date,
        learning,
        community,
        events,
        achievements,
        total: learning + community + events + achievements,
      };
    });

    const activeDays = new Set();
    [pointEvents, eventRegsInRange, certificatesInRange, completedGoalsInRange, enrollmentsAccessedInRange]
      .forEach((items) => {
        items.forEach((item) => {
          const key = toDayKey(item.createdAt || item.registeredAt || item.issuedAt || item.completedAt || item.lastAccessedAt);
          if (key) activeDays.add(key);
        });
      });

    const streakActiveDays = new Set();
    [communityStreakEvents, eventStreakRegistrations, certificateStreakItems, goalStreakItems, enrollmentStreakAccesses]
      .forEach((items) => {
        items.forEach((item) => {
          const key = toDayKey(item.createdAt || item.registeredAt || item.issuedAt || item.completedAt || item.lastAccessedAt);
          if (key) streakActiveDays.add(key);
        });
      });

    return {
      generatedAt: new Date().toISOString(),
      rangeDays: normalizedRange,
      profile: {
        displayName: user.displayName || null,
        email: user.email || null,
        phone: user.phone || null,
        photoURL: user.photoURL || null,
        subscriptionPlan: user.subscriptionPlan || null,
        subscriptionStatus: user.subscriptionStatus || null,
        isActive: user.isActive !== false,
        memberSince: user.createdAt,
        lastLoginAt: user.lastLoginAt || null,
        loginCount: user.loginCount || 0,
        completeness: calculateProfileCompleteness(user, assessment),
      },
      overview: {
        currentStreak: calculateStreak(streakActiveDays),
        activeDays: activeDays.size,
        rangeDays: normalizedRange,
      },
      learning: {
        totalEnrollments,
        completedCourses,
        inProgressCourses: Math.max(0, totalEnrollments - completedCourses),
        averageProgress,
        certificates: certificatesCount,
      },
      events: {
        registrations: eventRegistrations,
        attended: eventsAttended,
      },
      goals: {
        total: goals.length,
        active: goalsActive,
        completed: goalsCompleted,
        paused: goalsPaused,
        averageProgress: averageGoalProgress,
        activeGoals,
      },
      community: {
        points: communityPoints,
        posts: postsCount,
        comments: commentsCount,
      },
      wellness,
      courses: courseProgress,
      trend,
    };
};

/**
 * Full analytics dashboard for the authenticated user.
 * GET /api/user/analytics?range=30
 */
export const getUserAnalytics = async (req, res) => {
  try {
    const rangeDays = parseInt(req.query.range, 10);
    const analytics = await buildUserAnalytics({
      userId: req.user._id,
      rangeDays,
    });

    if (!analytics) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, ...analytics });
  } catch (error) {
    console.error('Get User Analytics Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load analytics',
      error: error.message,
    });
  }
};
