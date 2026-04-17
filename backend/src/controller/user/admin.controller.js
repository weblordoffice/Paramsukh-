import { User } from '../../models/user.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { Course } from '../../models/course.models.js';
import { UserMembership } from '../../models/userMembership.models.js';
import { upsertActiveUserMembership } from '../../services/userMembership.service.js';
import { getAutoEnrollCoursesForPlan } from '../../services/membershipAccess.service.js';
import { resolveMembershipPlanChargeAmount } from '../../services/membershipPlan.service.js';
import { syncUserCommunityMembershipsByPlan } from '../../services/planUpgrade.service.js';

const normalizeText = (value) => String(value || '').trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const normalizePhone = (value) => normalizeText(value).replace(/[\s-]/g, '');
const normalizePlan = (value) => normalizeText(value).toLowerCase();
const normalizeSubscriptionStatusInput = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return normalized;
  }
  return normalized === 'trial' ? 'inactive' : normalized;
};
const normalizeTags = (value) => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(
    new Set(
      raw
        .map((tag) => normalizeText(tag).toLowerCase())
        .filter(Boolean)
    )
  );
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^\+?[0-9]{10,15}$/.test(phone);

/**
 * Create a new user (Admin only)
 * POST /api/user/create
 */
export const createUserAdmin = async (req, res) => {
  try {
    const {
      displayName: rawDisplayName,
      email: rawEmail,
      phone: rawPhone,
      subscriptionPlan: rawSubscriptionPlan,
      tags: rawTags,
    } = req.body;

    const displayName = normalizeText(rawDisplayName);
    const email = normalizeEmail(rawEmail);
    const phone = normalizePhone(rawPhone);
    const tags = normalizeTags(rawTags);

    if (!displayName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name and Phone are required'
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10-15 digits (optionally with + prefix)'
      });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }

    const requestedPlan = normalizePlan(rawSubscriptionPlan || 'free');
    let finalPlan = 'free';
    let planConfig = null;

    if (requestedPlan !== 'free') {
      planConfig = await resolveMembershipPlanChargeAmount(requestedPlan);
      if (!planConfig.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid membership plan'
        });
      }
      finalPlan = planConfig.slug;
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
      email: email || undefined,
      phone,
      subscriptionPlan: finalPlan,
      subscriptionStatus: finalPlan === 'free' ? 'inactive' : 'active',
      subscriptionStartDate: finalPlan === 'free' ? null : new Date(),
      subscriptionEndDate: finalPlan === 'free'
        ? null
        : new Date(Date.now() + Number(planConfig?.plan?.validityDays || 365) * 24 * 60 * 60 * 1000),
      trialEndsAt: null,
      authProvider: 'phone', // Default since schema requires it
      isActive: true,
      tags,
    });

    await user.save();

    if (finalPlan !== 'free') {
      await upsertActiveUserMembership({
        userId: user._id,
        planSlug: finalPlan,
        startDate: user.subscriptionStartDate,
        endDate: user.subscriptionEndDate,
        source: 'admin_grant',
        metadata: { sourceController: 'admin.createUserAdmin' },
      });

      await syncUserCommunityMembershipsByPlan({
        userId: user._id,
        planSlug: finalPlan,
        membershipActive: true,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user
    });
  } catch (error) {
    console.error('❌ Error creating user:', error);

    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone or email already exists'
      });
    }

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
    const { displayName, email, phone, subscriptionPlan, isActive, tags } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (displayName !== undefined) {
      const normalizedDisplayName = normalizeText(displayName);
      if (!normalizedDisplayName) {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
      user.displayName = normalizedDisplayName;
    }

    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);
      if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Invalid email address' });
      }

      if (normalizedEmail) {
        const emailConflict = await User.findOne({ email: normalizedEmail, _id: { $ne: id } }).select('_id').lean();
        if (emailConflict) {
          return res.status(400).json({ success: false, message: 'Email is already in use by another user' });
        }
      }

      user.email = normalizedEmail || undefined;
    }

    let selectedPlanConfig = null;
    let shouldExpireMemberships = false;
    const membershipChanged = subscriptionPlan !== undefined;
    if (subscriptionPlan !== undefined) {
      const requestedPlan = normalizePlan(subscriptionPlan || 'free');
      let finalPlan = 'free';

      if (requestedPlan !== 'free') {
        selectedPlanConfig = await resolveMembershipPlanChargeAmount(requestedPlan);
        if (!selectedPlanConfig.isValid) {
          return res.status(400).json({ success: false, message: 'Invalid membership plan' });
        }
        finalPlan = selectedPlanConfig.slug;
      }

      user.subscriptionPlan = finalPlan;

      if (finalPlan === 'free') {
        shouldExpireMemberships = true;
        user.subscriptionStatus = 'inactive';
        user.subscriptionStartDate = null;
        user.subscriptionEndDate = null;
        user.trialEndsAt = null;
      } else {
        user.subscriptionStatus = 'active';
        user.subscriptionStartDate = new Date();
        user.subscriptionEndDate = new Date(
          Date.now() + Number(selectedPlanConfig?.plan?.validityDays || 365) * 24 * 60 * 60 * 1000
        );
        user.trialEndsAt = null;
      }
    }

    if (phone !== undefined) {
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        return res.status(400).json({ success: false, message: 'Phone is required' });
      }
      if (!isValidPhone(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Phone number must be 10-15 digits (optionally with + prefix)' });
      }

      const phoneConflict = await User.findOne({ phone: normalizedPhone, _id: { $ne: id } }).select('_id').lean();
      if (phoneConflict) {
        return res.status(400).json({ success: false, message: 'Phone is already in use by another user' });
      }

      user.phone = normalizedPhone;
    }

    if (typeof isActive === 'boolean') user.isActive = isActive;

    if (tags !== undefined) {
      user.tags = normalizeTags(tags);
    }

    await user.save();

    if (user.subscriptionPlan && user.subscriptionPlan !== 'free' && user.subscriptionStatus === 'active') {
      await upsertActiveUserMembership({
        userId: id,
        planSlug: user.subscriptionPlan,
        startDate: user.subscriptionStartDate || new Date(),
        endDate: user.subscriptionEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        source: 'admin_grant',
        metadata: { sourceController: 'admin.updateUserAdmin' },
      });
    }

    if (shouldExpireMemberships) {
      await UserMembership.updateMany(
        { userId: id, status: 'active', endDate: { $gte: new Date() } },
        {
          $set: {
            status: 'expired',
            endDate: new Date(),
            metadata: {
              sourceController: 'admin.updateUserAdmin',
              reason: 'downgraded_to_free',
            },
          },
        }
      );
    }

    if (membershipChanged) {
      await syncUserCommunityMembershipsByPlan({
        userId: id,
        planSlug: user.subscriptionPlan,
        membershipActive: user.subscriptionStatus === 'active',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);

    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Phone or email is already in use by another user'
      });
    }

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
    if (subscriptionPlan !== undefined) {
      const requestedPlan = normalizePlan(subscriptionPlan || 'free');
      if (requestedPlan !== 'free') {
        const planConfig = await resolveMembershipPlanChargeAmount(requestedPlan);
        if (!planConfig.isValid) {
          return res.status(400).json({
            success: false,
            message: 'Invalid membership plan'
          });
        }
        user.subscriptionPlan = planConfig.slug;
      } else {
        user.subscriptionPlan = 'free';
      }
    }
    
    if (subscriptionStatus) user.subscriptionStatus = normalizeSubscriptionStatusInput(subscriptionStatus);
    if (subscriptionStartDate) user.subscriptionStartDate = new Date(subscriptionStartDate);
    if (subscriptionEndDate) user.subscriptionEndDate = new Date(subscriptionEndDate);

    await user.save();

    if (user.subscriptionPlan && user.subscriptionPlan !== 'free' && user.subscriptionStatus === 'active') {
      await upsertActiveUserMembership({
        userId: id,
        planSlug: user.subscriptionPlan,
        startDate: user.subscriptionStartDate || new Date(),
        endDate: user.subscriptionEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        source: 'admin_grant',
        metadata: { sourceController: 'admin.updateUserMembership' },
      });
    } else {
      await UserMembership.updateMany(
        { userId: id, status: 'active', endDate: { $gte: new Date() } },
        {
          $set: {
            status: 'expired',
            endDate: new Date(),
            metadata: {
              sourceController: 'admin.updateUserMembership',
              reason: 'membership_not_active',
            },
          },
        }
      );
    }

    // Auto-enroll in courses if requested
    if (autoEnroll && user.subscriptionPlan && user.subscriptionPlan !== 'free') {
      const courses = await getAutoEnrollCoursesForPlan(user.subscriptionPlan);

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

        console.log(`✅ Admin updated membership for user ${id}: ${user.subscriptionPlan} (auto-enrolled in ${courses.length} courses)`);
      } else {
        console.warn(`⚠️ No published courses configured for ${user.subscriptionPlan} plan`);
      }
    } else {
      console.log(`✅ Admin updated membership for user ${id}: ${user.subscriptionPlan}`);
    }

    await syncUserCommunityMembershipsByPlan({
      userId: id,
      planSlug: user.subscriptionPlan,
      membershipActive: user.subscriptionStatus === 'active',
    });

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
