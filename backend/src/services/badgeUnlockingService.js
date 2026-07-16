import { User } from '../models/user.models.js';
import { Enrollment } from '../models/enrollment.models.js';

/**
 * Checks and unlocks achievements for the user based on dynamic database stats
 * Returns a list of newly unlocked badge IDs
 */
export const unlockBadgesForUser = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return [];

    let EventRegistration;
    try {
      const model = await import('../models/eventRegistration.models.js');
      EventRegistration = model.EventRegistration || model.default;
    } catch (e) {
      // Fallback if model doesn't exist
    }

    // 1. Fetch current user metrics
    const [
      totalEnrollments,
      completedCourses,
      eventRegistrations,
      eventsAttended
    ] = await Promise.all([
      Enrollment.countDocuments({ userId }),
      Enrollment.countDocuments({ userId, isCompleted: true }),
      EventRegistration ? EventRegistration.countDocuments({ userId }) : Promise.resolve(0),
      EventRegistration ? EventRegistration.countDocuments({ userId, status: 'attended' }) : Promise.resolve(0)
    ]);

    const loginCount = user.loginCount || 0;

    // 2. Define achievements criteria
    const badgesToCheck = [
      { id: 'first-step', name: 'First Step', condition: totalEnrollments >= 1 },
      { id: 'knowledge-seeker', name: 'Knowledge Seeker', condition: completedCourses >= 1 },
      { id: 'event-enthusiast', name: 'Event Enthusiast', condition: eventRegistrations >= 1 },
      { id: 'dedicated-learner', name: 'Dedicated Learner', condition: completedCourses >= 5 },
      { id: 'active-member', name: 'Active Member', condition: loginCount >= 10 },
      { id: 'community-pillar', name: 'Community Pillar', condition: eventsAttended >= 5 }
    ];

    const newlyUnlocked = [];
    let userModified = false;

    // 3. Evaluate criteria
    for (const check of badgesToCheck) {
      if (check.condition) {
        const alreadyUnlocked = user.unlockedBadges.some(b => b.badgeId === check.id);
        if (!alreadyUnlocked) {
          user.unlockedBadges.push({ badgeId: check.id, unlockedAt: new Date() });
          newlyUnlocked.push(check.id);
          userModified = true;
          console.log(`🏆 Badge unlocked for user ${user.displayName}: ${check.name}`);
        }
      }
    }

    if (userModified) {
      await user.save();
    }

    return newlyUnlocked;
  } catch (error) {
    console.error('❌ Error in badge unlocking engine:', error);
    return [];
  }
};
