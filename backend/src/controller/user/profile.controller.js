import { User } from '../../models/user.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { Course } from '../../models/course.models.js';
import { Group, GroupMember } from '../../models/community.models.js';
import { MEMBERSHIP_COURSE_ACCESS } from '../../models/enrollment.models.js';

/**
 * Get user profile
 * GET /api/user/profile
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user
    });

  } catch (error) {
    console.error("❌ Error fetching profile:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update user profile
 * PUT /api/user/profile
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { displayName, photoURL } = req.body;

    // Build update object (only include provided fields)
    const updateData = {};

    if (displayName !== undefined) {
      if (!displayName || displayName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Display name must be at least 2 characters"
        });
      }
      updateData.displayName = displayName.trim();
    }



    if (photoURL !== undefined) {
      updateData.photoURL = photoURL;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update"
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log(`✅ Profile updated for user: ${user.displayName}`);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user
    });

  } catch (error) {
    console.error("❌ Error updating profile:", error);



    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update profile photo
 * PUT /api/user/profile/photo
 */
export const updateProfilePhoto = async (req, res) => {
  try {
    const userId = req.user._id;
    const { photoURL } = req.body;

    if (!photoURL) {
      return res.status(400).json({
        success: false,
        message: "Photo URL is required"
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { photoURL },
      { new: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile photo updated successfully",
      photoURL: user.photoURL
    });

  } catch (error) {
    console.error("❌ Error updating profile photo:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Remove profile photo
 * DELETE /api/user/profile/photo
 */
export const removeProfilePhoto = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findByIdAndUpdate(
      userId,
      { photoURL: null },
      { new: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile photo removed successfully"
    });

  } catch (error) {
    console.error("❌ Error removing profile photo:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update user preferences
 * PUT /api/user/preferences
 */
export const updatePreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const { theme, notifications } = req.body;

    const updateData = { preferences: {} };

    if (theme !== undefined) {
      if (!['light', 'dark', 'system'].includes(theme)) {
        return res.status(400).json({
          success: false,
          message: "Theme must be 'light', 'dark', or 'system'"
        });
      }
      updateData['preferences.theme'] = theme;
    }

    if (notifications !== undefined) {
      updateData['preferences.notifications'] = !!notifications;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select('preferences');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      preferences: user.preferences
    });

  } catch (error) {
    console.error("❌ Error updating preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get subscription details
 * GET /api/user/subscription
 */
export const getSubscription = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .select('subscriptionPlan subscriptionStatus trialEndsAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const now = new Date();
    const isTrialActive = user.subscriptionStatus === 'trial' && user.trialEndsAt > now;
    const trialDaysLeft = isTrialActive
      ? Math.ceil((user.trialEndsAt - now) / (1000 * 60 * 60 * 24))
      : 0;

    return res.status(200).json({
      success: true,
      subscription: {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        isTrialActive,
        trialDaysLeft,
        hasProAccess: user.hasProAccess()
      }
    });

  } catch (error) {
    console.error("❌ Error fetching subscription:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get user statistics
 * GET /api/user/stats
 */
export const getUserStats = async (req, res) => {
  try {image.png
    const userId = req.user._id;

    // Import models dynamically to avoid circular dependencies
    const { Enrollment } = await import('../../models/enrollment.models.js');
    const { EventRegistration } = await import('../../models/eventRegistration.models.js');

    const [
      user,
      totalEnrollments,
      completedCourses,
      eventRegistrations,
      eventsAttended
    ] = await Promise.all([
      User.findById(userId).select('loginCount lastLoginAt createdAt'),
      Enrollment.countDocuments({ userId }),
      Enrollment.countDocuments({ userId, isCompleted: true }),
      EventRegistration.countDocuments({ userId }),
      EventRegistration.countDocuments({ userId, status: 'attended' })
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalEnrollments,
        completedCourses,
        inProgressCourses: totalEnrollments - completedCourses,
        eventRegistrations,
        eventsAttended,
        loginCount: user?.loginCount || 0,
        lastLoginAt: user?.lastLoginAt,
        memberSince: user?.createdAt
      }
    });

  } catch (error) {
    console.error("❌ Error fetching user stats:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Deactivate account
 * POST /api/user/deactivate
 */
export const deactivateAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log(`⚠️ Account deactivated: ${user.displayName}`);

    return res.status(200).json({
      success: true,
      message: "Account deactivated successfully. You can reactivate by logging in again."
    });

  } catch (error) {
    console.error("❌ Error deactivating account:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Delete account permanently
 * DELETE /api/user/account
 */
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { confirmDelete } = req.body;

    if (confirmDelete !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: "Please confirm deletion by sending confirmDelete: 'DELETE'"
      });
    }

    // Import models
    const { Enrollment } = await import('../../models/enrollment.models.js');
    const { EventRegistration } = await import('../../models/eventRegistration.models.js');

    // Delete user's data
    await Promise.all([
      Enrollment.deleteMany({ userId }),
      EventRegistration.deleteMany({ userId }),
      User.findByIdAndDelete(userId)
    ]);

    console.log(`🗑️ Account deleted: ${userId}`);

    res.clearCookie('token');

    return res.status(200).json({
      success: true,
      message: "Account and all associated data deleted permanently"
    });

  } catch (error) {
    console.error("❌ Error deleting account:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Purchase membership and auto-enroll in courses
 * POST /api/user/membership/purchase
 */
export const purchaseMembership = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plan } = req.body;

    // Validate plan
    const validPlans = ['bronze', 'copper', 'silver'];
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan. Must be one of: ${validPlans.join(', ')}`
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get courses that are configured for this plan via includedInPlans field
    const courses = await Course.find({
      includedInPlans: plan,
      status: 'published'
    });

    if (courses.length === 0) {
      console.warn(`⚠️ No courses found for ${plan} plan in database configuration.`);
      // We process the membership update anyway, assuming admin might add courses later
      // or this might be a plan without courses (unlikely but possible)
    } else {
      console.log(`Found ${courses.length} courses for plan ${plan}:`, courses.map(c => c.title));
    }

    // Update user subscription
    user.subscriptionPlan = plan;
    user.subscriptionStatus = 'active';
    await user.save();

    // Auto-enroll in courses (skip if already enrolled)
    const enrollmentPromises = courses.map(async (course) => {
      const existingEnrollment = await Enrollment.findOne({ userId, courseId: course._id });
      if (!existingEnrollment) {
        const enrollment = await Enrollment.create({
          userId,
          courseId: course._id,
          currentVideoId: course.videos.length > 0 ? course.videos[0]._id : null
        });

        // Update course enrollment count
        course.enrollmentCount += 1;
        await course.save();

        return enrollment;
      }
      return existingEnrollment;
    });

    const enrollments = await Promise.all(enrollmentPromises);

    // Auto-create groups for courses and add user to them
    const groupPromises = courses.map(async (course) => {
      // Check if group exists for this course
      let group = await Group.findOne({ courseId: course._id });

      if (!group) {
        // Create group if it doesn't exist
        group = await Group.create({
          name: `${course.title} Community`,
          description: `Discussion group for ${course.title} course members`,
          courseId: course._id,
          coverImage: course.thumbnail,
          memberCount: 0
        });
        console.log(`✅ Created group for course: ${course.title}`);
      }

      // Add user to group (skip if already member)
      const existingMembership = await GroupMember.findOne({
        groupId: group._id,
        userId
      });

      if (!existingMembership) {
        await GroupMember.create({
          groupId: group._id,
          userId,
          role: 'member'
        });

        // Update group member count
        group.memberCount += 1;
        await group.save();

        console.log(`✅ Added user to group: ${group.name}`);
      } else if (!existingMembership.isActive) {
        // Reactivate membership if it was deactivated
        existingMembership.isActive = true;
        await existingMembership.save();

        group.memberCount += 1;
        await group.save();
      }

      return group;
    });

    const groups = await Promise.all(groupPromises);

    console.log(`✅ User ${user.displayName} purchased ${plan} membership`);
    console.log(`   - Created ${enrollments.length} enrollment(s) for courses: ${courses.map(c => c.title).join(', ')}`);
    console.log(`   - Added to ${groups.length} community group(s): ${groups.map(g => g.name).join(', ')}`);

    return res.status(200).json({
      success: true,
      message: `Successfully purchased ${plan} membership`,
      subscription: {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus
      },
      enrolledCourses: courses.map(c => ({
        _id: c._id,
        title: c.title
      })),
      enrollmentCount: enrollments.length,
      communityGroups: groups.map(g => ({
        _id: g._id,
        name: g.name,
        memberCount: g.memberCount
      })),
      communityAccess: true
    });

  } catch (error) {
    console.error("❌ Error purchasing membership:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

