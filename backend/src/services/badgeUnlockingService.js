import { User } from '../models/user.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { EventRegistration } from '../models/eventRegistration.models.js';
import Certificate from '../models/certificate.models.js';
import { WellnessGoal } from '../models/wellnessGoal.models.js';
import { Post, Comment } from '../models/community.models.js';
import { CommunityPointEvent } from '../models/communityPoint.models.js';

export const BADGE_DEFINITIONS = [
  {
    id: 'first-step',
    title: 'First Step',
    description: 'Enrolled in your first course',
    requirement: 'Enroll in 1 course',
    icon: 'footsteps-outline',
    color: '#8B5CF6',
    category: 'learning',
    metric: 'totalEnrollments',
    target: 1,
    unit: 'course',
  },
  {
    id: 'knowledge-seeker',
    title: 'Knowledge Seeker',
    description: 'Completed your first course',
    requirement: 'Complete 1 course',
    icon: 'book-outline',
    color: '#3B82F6',
    category: 'learning',
    metric: 'completedCourses',
    target: 1,
    unit: 'course',
  },
  {
    id: 'event-enthusiast',
    title: 'Event Enthusiast',
    description: 'Registered for your first event',
    requirement: 'Register for 1 event',
    icon: 'calendar-outline',
    color: '#10B981',
    category: 'events',
    metric: 'eventRegistrations',
    target: 1,
    unit: 'event',
  },
  {
    id: 'dedicated-learner',
    title: 'Dedicated Learner',
    description: 'Completed five courses',
    requirement: 'Complete 5 courses',
    icon: 'trophy-outline',
    color: '#F59E0B',
    category: 'learning',
    metric: 'completedCourses',
    target: 5,
    unit: 'course',
  },
  {
    id: 'active-member',
    title: 'Active Member',
    description: 'Logged in ten times',
    requirement: 'Log in 10 times',
    icon: 'flame-outline',
    color: '#EF4444',
    category: 'engagement',
    metric: 'loginCount',
    target: 10,
    unit: 'login',
  },
  {
    id: 'community-pillar',
    title: 'Community Pillar',
    description: 'Attended five events',
    requirement: 'Attend 5 events',
    icon: 'people-outline',
    color: '#6366F1',
    category: 'events',
    metric: 'eventsAttended',
    target: 5,
    unit: 'event',
  },
  {
    id: 'goal-getter',
    title: 'Goal Getter',
    description: 'Completed your first wellness goal',
    requirement: 'Complete 1 wellness goal',
    icon: 'checkmark-done-outline',
    color: '#22C55E',
    category: 'wellness',
    metric: 'goalsCompleted',
    target: 1,
    unit: 'goal',
  },
  {
    id: 'goal-master',
    title: 'Goal Master',
    description: 'Completed five wellness goals',
    requirement: 'Complete 5 wellness goals',
    icon: 'ribbon-outline',
    color: '#14B8A6',
    category: 'wellness',
    metric: 'goalsCompleted',
    target: 5,
    unit: 'goal',
  },
  {
    id: 'wellness-explorer',
    title: 'Wellness Explorer',
    description: 'Created three wellness goals',
    requirement: 'Create 3 wellness goals',
    icon: 'compass-outline',
    color: '#0EA5E9',
    category: 'wellness',
    metric: 'goalsCreated',
    target: 3,
    unit: 'goal',
  },
  {
    id: 'certified',
    title: 'Certified',
    description: 'Earned your first certificate',
    requirement: 'Earn 1 certificate',
    icon: 'school-outline',
    color: '#D97706',
    category: 'learning',
    metric: 'certificates',
    target: 1,
    unit: 'certificate',
  },
  {
    id: 'lifelong-learner',
    title: 'Lifelong Learner',
    description: 'Earned three certificates',
    requirement: 'Earn 3 certificates',
    icon: 'medal-outline',
    color: '#A855F7',
    category: 'learning',
    metric: 'certificates',
    target: 3,
    unit: 'certificate',
  },
  {
    id: 'community-contributor',
    title: 'Community Contributor',
    description: 'Shared five posts or comments',
    requirement: 'Post or comment 5 times',
    icon: 'chatbubbles-outline',
    color: '#EC4899',
    category: 'community',
    metric: 'communityContributions',
    target: 5,
    unit: 'contribution',
  },
  {
    id: 'community-champion',
    title: 'Community Champion',
    description: 'Earned 100 community points',
    requirement: 'Earn 100 community points',
    icon: 'star-outline',
    color: '#F97316',
    category: 'community',
    metric: 'communityPoints',
    target: 100,
    unit: 'point',
  },
];

const loadMetrics = async (userId) => {
  const [
    user,
    totalEnrollments,
    completedCourses,
    eventRegistrations,
    eventsAttended,
    certificates,
    goalsCreated,
    goalsCompleted,
    communityPosts,
    communityComments,
    communityPointAgg,
  ] = await Promise.all([
    User.findById(userId).select('loginCount unlockedBadges').lean(),
    Enrollment.countDocuments({ userId }),
    Enrollment.countDocuments({ userId, isCompleted: true }),
    EventRegistration.countDocuments({ userId, status: { $ne: 'cancelled' } }),
    EventRegistration.countDocuments({ userId, status: 'attended' }),
    Certificate.countDocuments({ user: userId, isRevoked: false }),
    WellnessGoal.countDocuments({ userId }),
    WellnessGoal.countDocuments({ userId, status: 'completed' }),
    Post.countDocuments({ userId, isActive: true }),
    Comment.countDocuments({ userId, isActive: true }),
    CommunityPointEvent.aggregate([
      { $match: { userId, isActive: true } },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]),
  ]);

  if (!user) return null;

  const communityPoints = communityPointAgg?.[0]?.total || 0;

  return {
    user,
    metrics: {
      totalEnrollments,
      completedCourses,
      eventRegistrations,
      eventsAttended,
      loginCount: user.loginCount || 0,
      certificates,
      goalsCreated,
      goalsCompleted,
      communityPosts,
      communityComments,
      communityContributions: communityPosts + communityComments,
      communityPoints,
    },
  };
};

/**
 * Checks and unlocks achievements for the user based on live database metrics.
 * Returns a list of newly unlocked badge IDs.
 */
export const unlockBadgesForUser = async (userId) => {
  try {
    const result = await loadMetrics(userId);
    if (!result) return [];

    const { user, metrics } = result;
    const unlockedIds = new Set((user.unlockedBadges || []).map((badge) => badge.badgeId));
    const newlyUnlocked = [];

    for (const definition of BADGE_DEFINITIONS) {
      const current = Number(metrics[definition.metric] || 0);
      if (current >= definition.target && !unlockedIds.has(definition.id)) {
        unlockedIds.add(definition.id);
        newlyUnlocked.push(definition.id);
      }
    }

    if (newlyUnlocked.length > 0) {
      for (const badgeId of newlyUnlocked) {
        await User.updateOne(
          { _id: userId, 'unlockedBadges.badgeId': { $ne: badgeId } },
          { $push: { unlockedBadges: { badgeId, unlockedAt: new Date() } } }
        );
      }
      console.log(`🏆 Badges unlocked for user ${userId}: ${newlyUnlocked.join(', ')}`);
    }

    return newlyUnlocked;
  } catch (error) {
    console.error('❌ Error in badge unlocking engine:', error);
    return [];
  }
};

/**
 * Returns the full badge catalog with live progress and unlock state.
 */
export const getAchievementCatalog = async (userId) => {
  const result = await loadMetrics(userId);
  if (!result) return null;

  const { user, metrics } = result;
  const unlockedMap = new Map(
    (user.unlockedBadges || []).map((badge) => [badge.badgeId, badge.unlockedAt])
  );

  const badges = BADGE_DEFINITIONS.map((definition) => {
    const current = Number(metrics[definition.metric] || 0);
    const unlocked = unlockedMap.has(definition.id) || current >= definition.target;
    const percent = Math.min(100, Math.round((current / definition.target) * 100));

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      requirement: definition.requirement,
      icon: definition.icon,
      color: definition.color,
      category: definition.category,
      unlocked,
      unlockedAt: unlockedMap.get(definition.id) || null,
      progress: {
        current: Math.min(current, definition.target),
        target: definition.target,
        percent,
        unit: definition.unit,
      },
    };
  });

  return {
    badges,
    stats: {
      unlocked: badges.filter((badge) => badge.unlocked).length,
      total: badges.length,
      metrics,
    },
  };
};
