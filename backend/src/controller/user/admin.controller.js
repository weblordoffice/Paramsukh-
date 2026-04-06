import { User } from '../../models/user.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { Course } from '../../models/course.models.js';
import { Group } from '../../models/community.models.js';
import { GroupMember } from '../../models/community.models.js';
import { upsertActiveUserMembership } from '../../services/userMembership.service.js';
import { getAutoEnrollCoursesForPlan } from '../../services/membershipAccess.service.js';
import { cleanupExpiredCommunityMemberships, restoreCommunityMemberships } from '../../services/communityCleanup.service.js';

/**
 * Create a new user (Admin only)
 * POST /api/user/create
 */
export const createUserAdmin = async (req, res) => {
  try {
    const { displayName, email, phone, subscriptionPlan } = req.body;

    if (!displayName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name and Phone are required'
      });
    }

    // Check if user exists
    const query = [{ phone }];
    if (email) query.push({ email });

    const existingUser = await User.findOne({
      $or: query
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone or email already exists'
      });
    }

    const user = new User({
      displayName,
      email,
      phone,
      subscriptionPlan: subscriptionPlan || 'free',
      authProvider: 'phone', // Default since schema requires it
      isActive: true
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user
    });
  } catch (error) {
    console.error('❌ Error creating user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
};

/**
 * Update user details (Admin only)
 * PATCH /api/user/:id
 */
export const updateUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, email, phone, subscriptionPlan, isActive } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (displayName) user.displayName = displayName;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (subscriptionPlan) user.subscriptionPlan = subscriptionPlan;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
};

/**
 * Delete user (Admin only)
 * DELETE /api/user/:id
 */
export const deleteUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

/**
 * Get all users (Admin only)
 * GET /api/user/all
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select('-__v')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      users,
      total: users.length
    });
  } catch (error) {
    console.error('❌ Error fetching all users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

/**
 * Get user by ID (Admin only)
 * GET /api/user/:id
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};

/**
 * Update user membership (Admin only)
 * PATCH /api/user/:id/membership
 */
export const updateUserMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subscriptionPlan,
      subscriptionStatus,
      subscriptionStartDate,
      subscriptionEndDate,
      autoEnroll
    } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update subscription fields
    if (subscriptionPlan) user.subscriptionPlan = subscriptionPlan;
    
    // Track if membership status is changing
    const oldStatus = user.subscriptionStatus;
    if (subscriptionStatus) user.subscriptionStatus = subscriptionStatus;
    if (subscriptionStartDate) user.subscriptionStartDate = new Date(subscriptionStartDate);
    if (subscriptionEndDate) user.subscriptionEndDate = new Date(subscriptionEndDate);

    await user.save();

    // Handle community membership cleanup when membership expires/cancels
    if ((subscriptionStatus === 'expired' || subscriptionStatus === 'cancelled' || subscriptionPlan === 'free') && 
        oldStatus === 'active') {
      try {
        await cleanupExpiredCommunityMemberships(id);
        console.log(`🧹 Cleaned up community memberships for user ${id}`);
      } catch (error) {
        console.error(`⚠️ Failed to cleanup community memberships for user ${id}:`, error.message);
        // Don't fail the request, log the error
      }
    }

    // Handle community membership restoration when membership renews
    if (subscriptionStatus === 'active' && oldStatus !== 'active' && subscriptionPlan && subscriptionPlan !== 'free') {
      try {
        await restoreCommunityMemberships(id);
        console.log(`♻️ Restored community memberships for user ${id}`);
      } catch (error) {
        console.error(`⚠️ Failed to restore community memberships for user ${id}:`, error.message);
      }
    }

    if (user.subscriptionPlan && user.subscriptionPlan !== 'free' && user.subscriptionStatus === 'active') {
      await upsertActiveUserMembership({
        userId: id,
        planSlug: user.subscriptionPlan,
        startDate: user.subscriptionStartDate || new Date(),
        endDate: user.subscriptionEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        source: 'admin_grant',
        metadata: { sourceController: 'admin.updateUserMembership' },
      });
    }

    // Auto-enroll in courses if requested
    if (autoEnroll && subscriptionPlan && subscriptionPlan !== 'free') {
      const courses = await getAutoEnrollCoursesForPlan(subscriptionPlan);

      if (courses.length > 0) {

        // Enroll in courses
        for (const course of courses) {
          const existingEnrollment = await Enrollment.findOne({
            userId: id,
            courseId: course._id
          });

          if (!existingEnrollment) {
            await Enrollment.create({
              userId: id,
              courseId: course._id,
              currentVideoId: course.videos.length > 0 ? course.videos[0]._id : null
            });

            course.enrollmentCount += 1;
            await course.save();
            console.log(`✅ Enrolled user ${id} in course: ${course.title}`);
          } else {
            console.log(`ℹ️ User ${id} already enrolled in: ${course.title}`);
          }
        }

        // Add to community groups
        for (const course of courses) {
          // Get or create group for this course (atomic upsert to prevent duplicates)
          let group = await Group.findOneAndUpdate(
            { courseId: course._id },
            {
              $setOnInsert: {
                name: `${course.title} Community`,
                description: `Discussion group for ${course.title} course members`,
                coverImage: course.thumbnail,
                memberCount: 0
              }
            },
            { upsert: true, new: true }
          );

          const existingMembership = await GroupMember.findOne({
            groupId: group._id,
            userId: id
          });

          if (!existingMembership) {
            await GroupMember.create({
              groupId: group._id,
              userId: id,
              role: 'member'
            });
            
            // Update group member count atomically
            await Group.findByIdAndUpdate(group._id, { $inc: { memberCount: 1 } });
          }
        }

        console.log(`✅ Admin updated membership for user ${id}: ${subscriptionPlan} (auto-enrolled in ${courses.length} courses)`);
      } else {
        console.warn(`⚠️ No published courses configured for ${subscriptionPlan} plan`);
      }
    } else {
      console.log(`✅ Admin updated membership for user ${id}: ${subscriptionPlan}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Membership updated successfully',
      user
    });
  } catch (error) {
    console.error('❌ Error updating membership:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update membership',
      error: error.message
    });
  }
};

/**
 * Get user enrollments (Admin only)
 * GET /api/user/:userId/enrollments
 */
export const getUserEnrollments = async (req, res) => {
  try {
    const { userId } = req.params;

    const enrollments = await Enrollment.find({ userId })
      .populate('courseId', 'title thumbnail category')
      .sort({ enrolledAt: -1 });

    return res.status(200).json({
      success: true,
      enrollments,
      total: enrollments.length
    });
  } catch (error) {
    console.error('❌ Error fetching enrollments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch enrollments',
      error: error.message
    });
  }
};

/**
 * Get user payments (Admin only)
 * GET /api/user/:userId/payments
 */
export const getUserPayments = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('payments');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // payments array from user model
    const payments = user.payments || [];

    return res.status(200).json({
      success: true,
      payments,
      total: payments.length
    });
  } catch (error) {
    console.error('❌ Error fetching payments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};

/**
 * Get user activity (Admin only) - Optional
 * GET /api/user/:userId/activity
 */
export const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;

    // This is a placeholder - implement activity logging as needed
    // You could track: logins, enrollments, course progress, purchases, etc.

    const activities = [];

    return res.status(200).json({
      success: true,
      activities
    });
  } catch (error) {
    console.error('❌ Error fetching activity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity',
      error: error.message
    });
  }
};
