import { User } from '../models/user.models.js';
import { Course } from '../models/course.models.js';
import { Group, GroupMember } from '../models/community.models.js';
import { getAutoEnrollCoursesForPlan } from './membershipAccess.service.js';

/**
 * Handle community group enrollment when user upgrades their plan
 * Automatically enrolls user in new groups for courses included in the new plan
 */
export const handlePlanUpgrade = async (userId, newPlanSlug) => {
  try {
    console.log(`⬆️ Handling plan upgrade for user ${userId} to ${newPlanSlug}`);

    // Get courses for the new plan
    const newCourses = await getAutoEnrollCoursesForPlan(newPlanSlug);

    if (newCourses.length === 0) {
      console.log(`ℹ️ No courses configured for plan: ${newPlanSlug}`);
      return { success: true, enrolledInGroups: 0 };
    }

    let enrolledCount = 0;

    // Enroll user in groups for new courses
    for (const course of newCourses) {
      // Get or create group for this course
      let group = await Group.findOneAndUpdate(
        { courseId: course._id },
        {
          $setOnInsert: {
            name: `${course.title} Community`,
            description: `Discussion group for ${course.title} course members`,
            coverImage: course.thumbnail || null,
            memberCount: 0
          }
        },
        { upsert: true, new: true }
      );

      // Check if user is already a member (active or inactive)
      let existingMembership = await GroupMember.findOne({ 
        groupId: group._id, 
        userId 
      });

      if (!existingMembership) {
        // User never joined this group - create new membership
        await GroupMember.create({ 
          groupId: group._id, 
          userId, 
          role: 'member' 
        });
        
        // Increment member count atomically
        await Group.findByIdAndUpdate(group._id, { $inc: { memberCount: 1 } });
        enrolledCount++;
        
        console.log(`✅ Enrolled user ${userId} in new group: ${group.name}`);
      } else if (!existingMembership.isActive) {
        // User was previously removed - reactivate membership
        existingMembership.isActive = true;
        await existingMembership.save();
        
        // Increment member count atomically
        await Group.findByIdAndUpdate(group._id, { $inc: { memberCount: 1 } });
        enrolledCount++;
        
        console.log(`♻️ Reactivated membership for user ${userId} in group: ${group.name}`);
      } else {
        // User is already an active member - skip
        console.log(`⏭️ User ${userId} already active in group: ${group.name}`);
      }
    }

    console.log(`✅ Plan upgrade complete. Enrolled in ${enrolledCount} new groups`);

    return {
      success: true,
      enrolledInGroups: enrolledCount,
      totalCourses: newCourses.length
    };
  } catch (error) {
    console.error('❌ Error handling plan upgrade:', error);
    throw error;
  }
};

/**
 * Sync user's community memberships with their current plan
 * Use this when user manually triggers a refresh or after plan change
 */
export const syncUserCommunityMemberships = async (userId) => {
  try {
    console.log(`🔄 Syncing community memberships for user ${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // If user has no active membership, cleanup all groups
    if (!user.subscriptionPlan || user.subscriptionPlan === 'free' || user.subscriptionStatus !== 'active') {
      const result = await GroupMember.updateMany(
        { userId, isActive: true },
        { isActive: false }
      );

      // Decrement member counts
      if (result.modifiedCount > 0) {
        const affectedMemberships = await GroupMember.find({ userId, isActive: false });
        const groupIds = affectedMemberships.map(m => m.groupId);

        await Group.updateMany(
          { _id: { $in: groupIds }, memberCount: { $gt: 0 } },
          { $inc: { memberCount: -1 } }
        );
      }

      console.log(`🧹 Deactivated ${result.modifiedCount} memberships for inactive user`);
      return { success: true, deactivated: result.modifiedCount };
    }

    // Get courses for current plan
    const planCourses = await getAutoEnrollCoursesForPlan(user.subscriptionPlan);
    const planGroupIds = [];

    // Ensure user is enrolled in all groups for their plan
    for (const course of planCourses) {
      let group = await Group.findOneAndUpdate(
        { courseId: course._id },
        {
          $setOnInsert: {
            name: `${course.title} Community`,
            description: `Discussion group for ${course.title} course members`,
            coverImage: course.thumbnail || null,
            memberCount: 0
          }
        },
        { upsert: true, new: true }
      );

      planGroupIds.push(group._id);

      let existingMembership = await GroupMember.findOne({ 
        groupId: group._id, 
        userId 
      });

      if (!existingMembership) {
        await GroupMember.create({ 
          groupId: group._id, 
          userId, 
          role: 'member' 
        });
        await Group.findByIdAndUpdate(group._id, { $inc: { memberCount: 1 } });
      } else if (!existingMembership.isActive) {
        existingMembership.isActive = true;
        await existingMembership.save();
        await Group.findByIdAndUpdate(group._id, { $inc: { memberCount: 1 } });
      }
    }

    // Deactivate memberships for groups NOT in current plan
    const deactivationResult = await GroupMember.updateMany(
      { 
        userId, 
        isActive: true, 
        groupId: { $nin: planGroupIds } 
      },
      { isActive: false }
    );

    // Decrement counts for deactivated groups
    if (deactivationResult.modifiedCount > 0) {
      const deactivatedMemberships = await GroupMember.find({ 
        userId, 
        isActive: false,
        groupId: { $nin: planGroupIds }
      });
      const groupIds = deactivatedMemberships.map(m => m.groupId);

      await Group.updateMany(
        { _id: { $in: groupIds }, memberCount: { $gt: 0 } },
        { $inc: { memberCount: -1 } }
      );
    }

    console.log(`✅ Sync complete. Active in ${planGroupIds.length} groups, deactivated ${deactivationResult.modifiedCount}`);

    return {
      success: true,
      activeInGroups: planGroupIds.length,
      deactivated: deactivationResult.modifiedCount
    };
  } catch (error) {
    console.error('❌ Error syncing community memberships:', error);
    throw error;
  }
};
