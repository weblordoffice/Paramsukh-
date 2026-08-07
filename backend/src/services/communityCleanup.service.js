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

    // Capture active groupIds BEFORE deactivation to avoid re-decrementing already-inactive ones
    const activeBefore = await GroupMember.find({ userId, isActive: true })
      .select('groupId')
      .lean();
    const groupIds = activeBefore.map(m => m.groupId);

    // Deactivate all group memberships for this user
    const result = await GroupMember.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    console.log(`✅ Deactivated ${result.modifiedCount} group memberships for user ${userId}`);

    // Decrement member counts only for groups that were actually active before
    if (result.modifiedCount > 0 && groupIds.length > 0) {
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
 * Restore community group memberships when user renews subscription.
 * Only reactivates memberships for groups the user is currently entitled to.
 */
export const restoreCommunityMemberships = async (userId) => {
  try {
    console.log(`♻️ Restoring community memberships for user: ${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Only restore memberships that belong to the user's current plan
    const currentPlanSlug = user.subscriptionPlan?.toLowerCase?.() || 'free';
    const entitledGroupIds = await Group.find({
      $or: [
        { planSlug: currentPlanSlug },
        { planSlug: 'general' },
        { groupType: 'course' }, // Course groups are entitlement-based
      ]
    }).select('_id').lean();
    const entitledIds = entitledGroupIds.map(g => g._id);

    // Reactivate only previously-inactive memberships for entitled groups
    const result = await GroupMember.updateMany(
      { userId, isActive: false, groupId: { $in: entitledIds } },
      { isActive: true }
    );

    if (result.modifiedCount > 0) {
      await Group.updateMany(
        { _id: { $in: entitledIds }, memberCount: { $gte: 0 } },
        { $inc: { memberCount: 1 } }
      );
      console.log(`📈 Restored ${result.modifiedCount} group memberships for entitled groups`);
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

    // Find all users with expired/cancelled subscriptions that have actually passed endDate
    const expiredUsers = await User.find({
      subscriptionStatus: { $in: ['expired', 'cancelled'] },
      $or: [
        { subscriptionEndDate: { $lte: new Date() } },
        { subscriptionEndDate: null },
      ]
    }).select('_id');

    let totalCleaned = 0;

    for (const user of expiredUsers) {
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
