import { cleanupAllExpiredMemberships } from '../../services/communityCleanup.service.js';

/**
 * Scheduled cleanup endpoint - should be protected and called by cron job
 * GET /api/community/admin/cleanup-expired
 */
export const runScheduledCleanup = async (req, res) => {
  try {
    console.log('🗓️ Triggering scheduled community membership cleanup...');
    
    const result = await cleanupAllExpiredMemberships();
    
    return res.status(200).json({
      success: true,
      message: 'Scheduled cleanup completed',
      data: result
    });
  } catch (error) {
    console.error('❌ Scheduled cleanup failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Scheduled cleanup failed',
      error: error.message
    });
  }
};
