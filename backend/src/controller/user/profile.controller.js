import { User } from '../../models/user.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { resolveMembershipPlanChargeAmount, resolveMembershipPlanInheritanceBySlug, normalizePlanSlug } from '../../services/membershipPlan.service.js';
import { upsertActiveUserMembership } from '../../services/userMembership.service.js';
import { getAutoEnrollCoursesForPlan } from '../../services/membershipAccess.service.js';
import { handlePlanUpgrade } from '../../services/planUpgrade.service.js';

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
      .select('subscriptionPlan subscriptionStatus');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const normalizedStatus = user.subscriptionStatus === 'trial' ? 'inactive' : user.subscriptionStatus;

    const normalizedPlan = normalizePlanSlug(user.subscriptionPlan || 'free');
    let effectivePlans = normalizedPlan ? [normalizedPlan] : [];

    if (normalizedPlan && normalizedPlan !== 'free') {
      const inheritance = await resolveMembershipPlanInheritanceBySlug(normalizedPlan);
      if (inheritance.planSlugs.length > 0) {
        effectivePlans = inheritance.planSlugs;
      }
    }

    return res.status(200).json({
      success: true,
      subscription: {
        plan: user.subscriptionPlan,
        status: normalizedStatus,
        trialEndsAt: null,
        isTrialActive: false,
        trialDaysLeft: 0,
        hasProAccess: user.hasProAccess(),
        effectivePlans
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

    const planConfig = await resolveMembershipPlanChargeAmount(plan);
    if (!planConfig.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership plan'
      });
    }

    const finalPlan = planConfig.slug;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const courses = await getAutoEnrollCoursesForPlan(finalPlan);

    if (courses.length === 0) {
      console.warn(`⚠️ No courses found for ${finalPlan} plan in database configuration.`);
      // We process the membership update anyway, assuming admin might add courses later
      // or this might be a plan without courses (unlikely but possible)
    } else {
      console.log(`Found ${courses.length} courses for plan ${finalPlan}:`, courses.map(c => c.title));
    }

    // Update user subscription
    user.subscriptionPlan = finalPlan;
    user.subscriptionStatus = 'active';
    if (!user.subscriptionStartDate) {
      user.subscriptionStartDate = new Date();
    }
    if (!user.subscriptionEndDate) {
      const validityDays = Number(planConfig.plan?.validityDays || 365);
      user.subscriptionEndDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
    }
    await user.save();

    await upsertActiveUserMembership({
      userId,
      planSlug: finalPlan,
      startDate: user.subscriptionStartDate,
      endDate: user.subscriptionEndDate,
      source: 'purchase',
      metadata: { sourceController: 'profile.purchaseMembership' },
    });

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

    const communitySync = await handlePlanUpgrade(userId, finalPlan);

    console.log(`✅ User ${user.displayName} purchased ${finalPlan} membership`);
    console.log(`   - Created ${enrollments.length} enrollment(s) for courses: ${courses.map(c => c.title).join(', ')}`);
    console.log(`   - Category groups synced: ${communitySync.totalCategories}`);

    return res.status(200).json({
      success: true,
      message: `Successfully purchased ${finalPlan} membership`,
      subscription: {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus
      },
      enrolledCourses: courses.map(c => ({
        _id: c._id,
        title: c.title
      })),
      enrollmentCount: enrollments.length,
      communityGroups: [],
      communityGroupsCount: communitySync.totalCategories,
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

