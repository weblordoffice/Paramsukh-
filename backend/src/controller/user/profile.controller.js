import { User } from '../../models/user.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { Course } from '../../models/course.models.js';
import { UserMembership } from '../../models/userMembership.models.js';
import Assessment from '../../models/assessment.models.js';
import {
  resolveMembershipPlanChargeAmount,
  resolveMembershipPlanInheritanceBySlug,
  normalizePlanSlug,
} from '../../services/membershipPlan.service.js';
import { upsertActiveUserMembership } from '../../services/userMembership.service.js';
import { getAutoEnrollCoursesForPlan } from '../../services/membershipAccess.service.js';
import { handlePlanUpgrade } from '../../services/planUpgrade.service.js';
import { verifyRazorpaySignature, fetchPaymentDetails } from '../../services/razorpayService.js';
import { sendMembershipPurchaseEmail } from '../../services/emailService.js';

/**
 * Get user profile
 * GET /api/user/profile
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const [user, assessment] = await Promise.all([
      User.findById(userId).select('-__v'),
      Assessment.findOne({ user: userId })
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user,
      profileDetails: assessment || null
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
    const {
      displayName,
      photoURL,
      age,
      occupation,
      location,
      countryCode,
      countryName,
      stateCode,
      stateName,
      stressLevel,
      sleepQuality,
      energyLevel,
      moodRating,
      physicalActivityLevel,
      physicalIssue,
      physicalIssueDetails,
      specialDiseaseIssue,
      specialDiseaseDetails,
      relationshipIssue,
      relationshipIssueDetails,
      financialIssue,
      financialIssueDetails,
      mentalHealthIssue,
      mentalHealthIssueDetails,
      spiritualGrowth,
      spiritualGrowthDetails
    } = req.body;

    // 1. Build update object for User (only include provided fields)
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

    let user = req.user;
    if (Object.keys(updateData).length > 0) {
      user = await User.findByIdAndUpdate(
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
    }

    // 2. Build and save Assessment details if any assessment focus fields are provided
    const assessmentFields = {
      age,
      occupation,
      location,
      countryCode,
      countryName,
      stateCode,
      stateName,
      stressLevel,
      sleepQuality,
      energyLevel,
      moodRating,
      physicalActivityLevel,
      physicalIssue,
      physicalIssueDetails,
      specialDiseaseIssue,
      specialDiseaseDetails,
      relationshipIssue,
      relationshipIssueDetails,
      financialIssue,
      financialIssueDetails,
      mentalHealthIssue,
      mentalHealthIssueDetails,
      spiritualGrowth,
      spiritualGrowthDetails
    };

    let hasAssessmentUpdates = false;
    const assessmentUpdateData = {};

    Object.keys(assessmentFields).forEach(key => {
      if (assessmentFields[key] !== undefined) {
        assessmentUpdateData[key] = assessmentFields[key];
        hasAssessmentUpdates = true;
      }
    });

    let assessment = null;
    if (hasAssessmentUpdates) {
      assessment = await Assessment.findOne({ user: userId });
      if (!assessment) {
        assessment = new Assessment({
          user: userId,
          age: age || 30,
          occupation: occupation || 'Self-employed',
          location: location || 'India',
          physicalIssue: physicalIssue || false,
          specialDiseaseIssue: specialDiseaseIssue || false,
          relationshipIssue: relationshipIssue || false,
          financialIssue: financialIssue || false,
          mentalHealthIssue: mentalHealthIssue || false,
          spiritualGrowth: spiritualGrowth || false
        });
      }

      Object.keys(assessmentUpdateData).forEach(key => {
        assessment[key] = assessmentUpdateData[key];
      });

      await assessment.save();
    } else {
      assessment = await Assessment.findOne({ user: userId });
    }

    console.log(`✅ Profile updated for user: ${user.displayName}`);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
      profileDetails: assessment
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
    const { theme, notifications, emailNotifications, autoPlay, dataSaver } = req.body;

    const updateData = {};

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
    
    if (emailNotifications !== undefined) {
      updateData['preferences.emailNotifications'] = !!emailNotifications;
    }
    
    if (autoPlay !== undefined) {
      updateData['preferences.autoPlay'] = !!autoPlay;
    }
    
    if (dataSaver !== undefined) {
      updateData['preferences.dataSaver'] = !!dataSaver;
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
    const selectedPlan = normalizedPlan;

    let selectedPlanLabel = normalizedPlan;
    if (normalizedPlan && normalizedPlan !== 'free') {
      const selectedPlanConfig = await resolveMembershipPlanChargeAmount(normalizedPlan);
      if (selectedPlanConfig?.isValid) {
        selectedPlanLabel = selectedPlanConfig.displayTitle || normalizedPlan;
      }
    }

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
        selectedPlan,
        selectedPlanLabel,
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
  try {
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
 * 
 * NOTE: This endpoint requires a valid Razorpay payment verification.
 * Direct activation without payment is blocked. Use the payment flow:
 * 1. POST /api/payments/create-membership-payment → get payment link
 * 2. Complete payment on Razorpay
 * 3. POST /api/payments/verify-membership-payment → verify payment
 * The verify endpoint will call upsertActiveUserMembership to activate.
 */
export const purchaseMembership = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plan, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    // Require payment verification — no free activation
    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification required. Use /api/payments/create-membership-payment to initiate payment.'
      });
    }

    const planConfig = await resolveMembershipPlanChargeAmount(plan);
    if (!planConfig.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership plan'
      });
    }

    // Verify Razorpay signature and payment details
    const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Signature mismatch.'
      });
    }

    let paymentDetails;
    try {
      paymentDetails = await fetchPaymentDetails(razorpayPaymentId);
      if (paymentDetails.status !== 'captured') {
        return res.status(400).json({ success: false, message: 'Payment not captured' });
      }
      if (paymentDetails.order_id !== razorpayOrderId) {
        return res.status(400).json({ success: false, message: 'Payment order mismatch' });
      }
      if (Number(paymentDetails.amount) !== Number(planConfig.amount * 100)) {
        return res.status(400).json({ success: false, message: 'Payment amount mismatch' });
      }
    } catch (paymentError) {
      console.error('Payment verification error:', paymentError);
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Please try again.'
      });
    }

    const finalPlan = planConfig.slug;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Replay protection — prevent double-activation with the same payment
    const paymentAlreadyUsed = (user.payments || []).some(
      (p) => p.paymentId === razorpayPaymentId || p.orderId === razorpayOrderId
    );
    if (paymentAlreadyUsed) {
      return res.status(400).json({ success: false, message: 'Payment already recorded' });
    }

    const courseSelectionEnabled = planConfig?.plan?.access?.courseSelection?.enabled || false;
    const maxSelectableCourses = planConfig?.plan?.access?.courseSelection?.maxSelectableCourses || 0;

    const courses = courseSelectionEnabled
      ? []
      : await getAutoEnrollCoursesForPlan(finalPlan);

    if (courses.length === 0) {
      console.warn(`⚠️ No courses found for ${finalPlan} plan in database configuration.`);
    } else {
      console.log(`Found ${courses.length} courses for plan ${finalPlan}:`, courses.map(c => c.title));
    }

    user.subscriptionPlan = finalPlan;
    user.subscriptionStatus = 'active';
    if (!user.subscriptionStartDate) {
      user.subscriptionStartDate = new Date();
    }
    if (!user.subscriptionEndDate) {
      const validityDays = Number(planConfig.validityDays || planConfig.plan?.validityDays || 365);
      user.subscriptionEndDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
    }
    await user.save();

    await upsertActiveUserMembership({
      userId,
      planSlug: finalPlan,
      planConfig,
      startDate: user.subscriptionStartDate,
      endDate: user.subscriptionEndDate,
      source: 'purchase',
      metadata: {
        sourceController: 'profile.purchaseMembership',
        razorpayPaymentId,
        razorpayOrderId,
      },
    });

    // Auto-enroll in courses (skip if already enrolled) — only for legacy plans without course selection
    let enrollments = [];
    let enrolledCount = 0;
    if (courses.length > 0) {
      const enrollmentPromises = courses.map(async (course) => {
        const existingEnrollment = await Enrollment.findOne({ userId, courseId: course._id });
        if (!existingEnrollment) {
          const enrollment = await Enrollment.create({
            userId,
            courseId: course._id,
            currentVideoId: course.videos.length > 0 ? course.videos[0]._id : null
          });
          await Course.findByIdAndUpdate(course._id, { $inc: { enrollmentCount: 1 } });
          return enrollment;
        }
        return existingEnrollment;
      });
      enrollments = await Promise.all(enrollmentPromises);
      enrolledCount = enrollments.filter((e) => e && !e.isNew).length;
    }

    const communitySync = await handlePlanUpgrade(userId, finalPlan);

    console.log(`✅ User ${user.displayName} purchased ${finalPlan} membership`);
    if (courseSelectionEnabled) {
      console.log(`   🔢 Course selection enabled — ${maxSelectableCourses} credits available`);
    } else {
      console.log(`   - Created ${enrolledCount} enrollment(s) for courses: ${courses.map(c => c.title).join(', ')}`);
    }
    console.log(`   - Category groups synced: ${communitySync.totalCategories}`);

    const membership = await UserMembership.findOne({ userId, status: 'active', endDate: { $gte: new Date() } })
      .sort({ endDate: -1 })
      .lean();

    try {
      sendMembershipPurchaseEmail(user);
    } catch (emailErr) {
      console.error('Membership purchase email failed:', emailErr?.message || emailErr);
    }

    return res.status(200).json({
      success: true,
      message: courseSelectionEnabled
        ? `Successfully purchased ${finalPlan} membership. Select your ${maxSelectableCourses} course(s)!`
        : `Successfully purchased ${finalPlan} membership`,
      subscription: {
        plan: user.subscriptionPlan,
        selectedPlan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        membershipId: membership?._id,
      },
      courseSelection: courseSelectionEnabled ? {
        enabled: true,
        maxSelectable: maxSelectableCourses,
        remaining: maxSelectableCourses,
        membershipId: membership?._id,
      } : null,
      enrolledCourses: courses.map(c => ({
        _id: c._id,
        title: c.title
      })),
      enrollmentCount: enrolledCount,
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

