import { getAchievementCatalog, unlockBadgesForUser } from '../../services/badgeUnlockingService.js';

/**
 * Get the user's achievement catalog with live progress.
 * GET /api/user/achievements
 */
export const getUserAchievements = async (req, res) => {
  try {
    const userId = req.user._id;

    // Evaluate first so newly earned badges are persisted and returned consistently.
    await unlockBadgesForUser(userId);

    const catalog = await getAchievementCatalog(userId);
    if (!catalog) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      achievements: catalog.badges,
      stats: catalog.stats,
    });
  } catch (error) {
    console.error('Get User Achievements Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load achievements',
      error: error.message,
    });
  }
};
