import { GroupMember, Group } from '../models/community.models.js';
import { User } from '../models/user.models.js';

/**
 * Cleanup community group memberships when user's membership expires
 * This should be called:
 * 1. When subscription status changes to 'expired' or 'cancelled'
 * 2. On a scheduled cron job to catch any missed cleanups
 */
export const cleanupExpiredCommunityMemberships = async (userId) => {
  try {
    console.log(`🧹 Starting community membership cleanup for user: ${userId}`);

    // Deactivate all group memberships for this user
    const result = await GroupMember.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    console.log(`✅ Deactivated ${result.modifiedCount} group memberships for user ${userId}`);

    // Decrement member counts for affected groups
    if (result.modifiedCount > 0) {
      const affectedMemberships = await GroupMember.find({ userId, isActive: false });
      const groupIds = affectedMemberships.map(m => m.groupId);

      // Decrement counts atomically for each group
      await Group.updateMany(
        { _id: { $in: groupIds }, memberCount: { $gt: 0 } },
        { $inc: { memberCount: -1 } }
      );

      console.log(`📉 Decremented member counts for ${groupIds.length} groups`);
    }

    return {
      success: true,
      deactivatedCount: result.modifiedCount
    };
  } catch (error) {
    console.error('❌ Error cleaning up community memberships:', error);
    throw error;
  }
};

/**
 * Restore community group memberships when user renews subscription
 */
export const restoreCommunityMemberships = async (userId) => {
  try {
    console.log(`♻️ Restoring community memberships for user: ${userId}`);

    // Get user's courses to determine which groups they should be in
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Reactivate memberships for groups where user was previously active
    const result = await GroupMember.updateMany(
      { userId, isActive: false },
      { isActive: true }
    );

    if (result.modifiedCount > 0) {
      // Increment member counts for restored groups
      const restoredMemberships = await GroupMember.find({ userId, isActive: true });
      const groupIds = restoredMemberships.map(m => m.groupId);

      await Group.updateMany(
        { _id: { $in: groupIds } },
        { $inc: { memberCount: 1 } }
      );

      console.log(`📈 Restored ${result.modifiedCount} group memberships`);
    } else {
      console.log(`ℹ️  No memberships to restore for user ${userId}`);
    }

    return {
      success: true,
      restoredCount: result.modifiedCount
    };
  } catch (error) {
    console.error('❌ Error restoring community memberships:', error);
    throw error;
  }
};

/**
 * Scheduled job: Clean up all expired memberships across the system
 * Run this daily to catch any missed cleanups
 */
export const cleanupAllExpiredMemberships = async () => {
  try {
    console.log('🧹 Running scheduled community membership cleanup...');

    // Find all users with expired/cancelled subscriptions
    const expiredUsers = await User.find({
      subscriptionStatus: { $in: ['expired', 'cancelled'] }
    }).select('_id');

    let totalCleaned = 0;

    for (const user of expiredUsers) {
      // Check if user still has active group memberships
      const activeMemberships = await GroupMember.countDocuments({
        userId: user._id,
        isActive: true
      });

      if (activeMemberships > 0) {
        await cleanupExpiredCommunityMemberships(user._id);
        totalCleaned += activeMemberships;
      }
    }

    console.log(`✅ Scheduled cleanup complete. Cleaned ${totalCleaned} memberships`);
    return { success: true, totalCleaned };
  } catch (error) {
    console.error('❌ Error in scheduled cleanup:', error);
    throw error;
  }
};
