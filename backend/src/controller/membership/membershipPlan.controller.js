import { MembershipPlan } from '../../models/membershipPlan.models.js';
import { User } from '../../models/user.models.js';
import { UserMembership } from '../../models/userMembership.models.js';
import { MembershipSelectionLog } from '../../models/membershipSelectionLog.models.js';
import { AdminPaymentLink } from '../../models/adminPaymentLink.models.js';
import { CoursePlan } from '../../models/coursePlan.models.js';
import { Group, GroupMember, Post, Comment } from '../../models/community.models.js';
import { getPlanCourses, resolvePlanCourseIds } from '../../services/planCourses.service.js';

const normalizeSlug = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const normalizeStringList = (values = []) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(
    values
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
  )];
};

const ALLOWED_PLAN_FIELDS = [
  'title', 'slug', 'description',
  'status', 'displayOrder', 'validityDays', 'isLifetime',
  'pricing', 'access', 'benefits', 'previewVideos', 'metadata'
];

const sanitizePlanPayload = (body = {}) => {
  const payload = {};
  for (const field of ALLOWED_PLAN_FIELDS) {
    if (body[field] !== undefined) {
      payload[field] = body[field];
    }
  }

  if (payload.title) {
    payload.title = String(payload.title).trim();
  }

  if (payload.slug) {
    payload.slug = normalizeSlug(payload.slug);
  } else if (payload.title) {
    payload.slug = normalizeSlug(payload.title);
  }

  if (payload.access) {
    payload.access.includedCategories = normalizeStringList(payload.access.includedCategories);
    payload.access.includedSubcategories = normalizeStringList(payload.access.includedSubcategories);
  }

  if (payload.access?.inheritedPlanIds && Array.isArray(payload.access.inheritedPlanIds)) {
    payload.access.inheritedPlanIds = [...new Set(payload.access.inheritedPlanIds.filter(Boolean).map(String))];
  }

  if (payload.description !== undefined) {
    payload.description = String(payload.description || '').trim();
  }

  if (payload.benefits && Array.isArray(payload.benefits)) {
    payload.benefits = payload.benefits.map(b => ({
      text: String((b && b.text) || '').trim(),
      included: b && b.included !== false
    })).filter(b => b.text.length > 0);
  }

  if (payload.previewVideos && Array.isArray(payload.previewVideos)) {
    payload.previewVideos = payload.previewVideos.map((v) => ({
      title: String((v && v.title) || '').trim(),
      videoUrl: String((v && v.videoUrl) || '').trim(),
      thumbnailUrl: v && v.thumbnailUrl ? String(v.thumbnailUrl).trim() : null,
      duration: v && v.duration ? String(v.duration).trim() : '',
    })).filter(v => v.videoUrl);
  }

  return payload;
};

const validatePlanPayload = (payload = {}) => {
  if (!payload.title) {
    return 'title is required';
  }

  if (!payload.slug) {
    return 'slug is required';
  }

  if (payload.pricing?.oneTime?.amount === undefined || payload.pricing?.oneTime?.amount === null) {
    return 'pricing.oneTime.amount is required';
  }

  const oneTimeAmount = Number(payload.pricing?.oneTime?.amount);
  if (Number.isNaN(oneTimeAmount) || oneTimeAmount < 0) {
    return 'pricing.oneTime.amount must be a non-negative number';
  }

  const recurringMonthly = payload.pricing?.recurring?.monthly?.amount;
  if (recurringMonthly !== undefined && recurringMonthly !== null) {
    const monthlyAmount = Number(recurringMonthly);
    if (Number.isNaN(monthlyAmount) || monthlyAmount < 0) {
      return 'pricing.recurring.monthly.amount must be a non-negative number';
    }
  }

  const recurringYearly = payload.pricing?.recurring?.yearly?.amount;
  if (recurringYearly !== undefined && recurringYearly !== null) {
    const yearlyAmount = Number(recurringYearly);
    if (Number.isNaN(yearlyAmount) || yearlyAmount < 0) {
      return 'pricing.recurring.yearly.amount must be a non-negative number';
    }
  }

  const validityDays = Number(payload.validityDays ?? 365);
  if (!payload.isLifetime && (Number.isNaN(validityDays) || validityDays < 1)) {
    return 'validityDays must be at least 1';
  }

  const accessMode = payload.access?.accessMode;
  if (accessMode && accessMode !== 'entitlement_only') {
    return 'access.accessMode is invalid';
  }

  return null;
};

export const createMembershipPlan = async (req, res) => {
  try {
    const payload = sanitizePlanPayload(req.body);

    const validationError = validatePlanPayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const existing = await MembershipPlan.findOne({ slug: payload.slug }).select('_id').lean();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Plan slug already exists' });
    }

    const plan = await MembershipPlan.create(payload);

    return res.status(201).json({
      success: true,
      message: 'Membership plan created successfully',
      data: plan,
    });
  } catch (error) {
    console.error('Error creating membership plan:', error);
    return res.status(500).json({ success: false, message: 'Failed to create membership plan', error: error.message });
  }
};

export const listMembershipPlansAdmin = async (req, res) => {
  try {
    const { status, search } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const plans = await MembershipPlan.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    const plansWithCounts = await Promise.all(
      plans.map(async (plan) => {
        try {
          const courseIds = await resolvePlanCourseIds(plan);
          return { ...plan, courseCount: courseIds.length };
        } catch (countError) {
          console.error(`Failed to count courses for plan ${plan.slug}:`, countError.message);
          return { ...plan, courseCount: 0 };
        }
      })
    );

    return res.status(200).json({
      success: true,
      data: plansWithCounts,
      total: plansWithCounts.length,
    });
  } catch (error) {
    console.error('Error listing membership plans:', error);
    return res.status(500).json({ success: false, message: 'Failed to load membership plans', error: error.message });
  }
};

export const getMembershipPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await MembershipPlan.findById(id);

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Membership plan not found' });
    }

    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    console.error('Error fetching membership plan:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch membership plan', error: error.message });
  }
};

export const updateMembershipPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = sanitizePlanPayload(req.body);

    const mergedPayload = {
      ...payload,
    };

    const existingPlan = await MembershipPlan.findById(id);
    if (!existingPlan) {
      return res.status(404).json({ success: false, message: 'Membership plan not found' });
    }

    if (payload.slug && payload.slug !== existingPlan.slug) {
      const duplicate = await MembershipPlan.findOne({ slug: payload.slug, _id: { $ne: id } }).select('_id').lean();
      if (duplicate) {
        return res.status(409).json({ success: false, message: 'Plan slug already exists' });
      }
    }

    const candidate = {
      title: payload.title ?? existingPlan.title,
      slug: payload.slug ?? existingPlan.slug,
      pricing: payload.pricing ?? existingPlan.pricing,
      validityDays: payload.validityDays ?? existingPlan.validityDays,
      isLifetime: payload.isLifetime ?? existingPlan.isLifetime,
      access: {
        ...(existingPlan.access?.toObject?.() || existingPlan.access || {}),
        ...(payload.access || {}),
        limits: {
          ...((existingPlan.access?.limits?.toObject?.() || existingPlan.access?.limits || {})),
          ...(payload.access?.limits || {}),
        },
      },
    };

    const validationError = validatePlanPayload(candidate);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    // Save the validated candidate (not raw mergedPayload) using .set() for proper Mongoose validation
    existingPlan.set(mergedPayload);
    await existingPlan.save();

    return res.status(200).json({
      success: true,
      message: 'Membership plan updated successfully',
      data: existingPlan,
    });
  } catch (error) {
    console.error('Error updating membership plan:', error);
    return res.status(500).json({ success: false, message: 'Failed to update membership plan', error: error.message });
  }
};

export const updateMembershipPlanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const plan = await MembershipPlan.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Membership plan not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Membership plan status updated',
      data: plan,
    });
  } catch (error) {
    console.error('Error updating membership plan status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update plan status', error: error.message });
  }
};

/**
 * Delete the community groups that belong to a plan (plan-level parent and its
 * category subgroups) along with their members, posts and comments.
 * The General (public) group is never removed.
 */
const deletePlanCommunityGroups = async (planSlug) => {
  const slug = normalizeSlug(planSlug);
  if (!slug || slug === 'general') {
    return { groups: 0, members: 0, posts: 0, comments: 0 };
  }

  const planGroups = await Group.find({
    $or: [
      { groupType: 'plan', planSlug: slug },
      { groupType: 'category', planSlug: slug },
    ],
  })
    .select('_id')
    .lean();

  const groupIds = planGroups.map((group) => group._id);
  if (groupIds.length === 0) {
    return { groups: 0, members: 0, posts: 0, comments: 0 };
  }

  const posts = await Post.find({ groupId: { $in: groupIds } }).select('_id').lean();
  const postIds = posts.map((post) => post._id);

  const [groupResult, memberResult, postResult, commentResult] = await Promise.all([
    Group.deleteMany({ _id: { $in: groupIds } }),
    GroupMember.deleteMany({ groupId: { $in: groupIds } }),
    Post.deleteMany({ groupId: { $in: groupIds } }),
    postIds.length > 0
      ? Comment.deleteMany({ postId: { $in: postIds } })
      : Promise.resolve({ deletedCount: 0 }),
  ]);

  return {
    groups: groupResult.deletedCount || 0,
    members: memberResult.deletedCount || 0,
    posts: postResult.deletedCount || 0,
    comments: commentResult.deletedCount || 0,
  };
};

export const deleteMembershipPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await MembershipPlan.findById(id);

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Membership plan not found' });
    }

    const slug = normalizeSlug(plan.slug);
    const force = toBoolean(req.body?.force ?? req.query?.force, false);

    // Gather everything related to this plan so we can warn before the
    // destructive cascade. User accounts themselves are never deleted.
    const [associatedCourseIds, membershipCount, assignedUserCount, groupCount] = await Promise.all([
      resolvePlanCourseIds(plan),
      UserMembership.countDocuments({ planId: plan._id }),
      User.countDocuments({ subscriptionPlan: slug }),
      Group.countDocuments({
        $or: [
          { groupType: 'plan', planSlug: slug },
          { groupType: 'category', planSlug: slug },
        ],
      }),
    ]);

    const hasRelatedRecords =
      associatedCourseIds.length > 0 || membershipCount > 0 || assignedUserCount > 0 || groupCount > 0;

    // Deleting the plan cascades to every related record, so require an explicit
    // confirmation (force) when anything is still attached.
    if (hasRelatedRecords && !force) {
      return res.status(409).json({
        success: false,
        requiresConfirmation: true,
        code: 'PLAN_HAS_RELATED_RECORDS',
        impact: {
          courses: associatedCourseIds.length,
          memberships: membershipCount,
          assignedUsers: assignedUserCount,
          communityGroups: groupCount,
        },
        message:
          `Deleting "${plan.title}" will permanently remove ${associatedCourseIds.length} course mapping(s), ` +
          `${membershipCount} membership record(s), ${assignedUserCount} user subscription assignment(s) ` +
          `(users are kept and reset to the free plan) and ${groupCount} community group(s).`,
      });
    }

    // 1. Delete memberships and their course-selection logs.
    const memberships = await UserMembership.find({ planId: plan._id }).select('_id').lean();
    const membershipIds = memberships.map((membership) => membership._id);
    if (membershipIds.length > 0) {
      await MembershipSelectionLog.deleteMany({ membershipId: { $in: membershipIds } });
    }
    await UserMembership.deleteMany({ planId: plan._id });

    // 2. Keep user accounts, but drop references to the deleted plan.
    if (assignedUserCount > 0) {
      await User.updateMany(
        { subscriptionPlan: slug },
        { $set: { subscriptionPlan: 'free', subscriptionStatus: 'inactive' } }
      );
    }
    await User.updateMany(
      { 'pendingMembershipPaymentLink.plan': slug },
      { $unset: { pendingMembershipPaymentLink: '' } }
    );

    // 3. Delete admin payment links created for this plan.
    await AdminPaymentLink.deleteMany({ planSlug: slug });

    // 4. Remove this plan from inheritance chains and course-plan mappings.
    await Promise.all([
      MembershipPlan.updateMany(
        { 'access.inheritedPlanIds': plan._id },
        { $pull: { 'access.inheritedPlanIds': plan._id } }
      ),
      CoursePlan.deleteMany({ planId: plan._id }),
    ]);

    // 5. Delete the plan's community groups (plan + category subgroups) and content.
    const communityCleanup = await deletePlanCommunityGroups(slug);

    await MembershipPlan.findByIdAndDelete(plan._id);

    return res.status(200).json({
      success: true,
      message: 'Membership plan and all related records deleted. User accounts were preserved.',
      data: {
        communityGroupsDeleted: communityCleanup.groups,
        membershipsDeleted: membershipIds.length,
        usersReset: assignedUserCount,
      },
    });
  } catch (error) {
    console.error('Error deleting membership plan:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete membership plan', error: error.message });
  }
};

export const listMembershipPlansPublic = async (req, res) => {
  try {
    const plans = await MembershipPlan.find({ status: 'published' })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    const plansWithCounts = await Promise.all(
      plans.map(async (plan) => {
        try {
          const courseIds = await resolvePlanCourseIds(plan);
          return { ...plan, courseCount: courseIds.length };
        } catch (countError) {
          console.error(`Failed to count courses for plan ${plan.slug}:`, countError.message);
          return { ...plan, courseCount: 0 };
        }
      })
    );

    return res.status(200).json({
      success: true,
      data: plansWithCounts,
      total: plansWithCounts.length,
    });
  } catch (error) {
    console.error('Error fetching public membership plans:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch plans', error: error.message });
  }
};

export const getPlanEligibleCourses = async (req, res) => {
  try {
    const { planSlug } = req.params;
    const slug = normalizeSlug(planSlug);
    if (!slug) {
      return res.status(400).json({ success: false, message: 'planSlug is required' });
    }

    const plan = await MembershipPlan.findOne({ slug, status: 'published' }).lean();
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const selectionEnabled = !!plan.access?.courseSelection?.enabled;
    const courses = await getPlanCourses(plan);

    return res.status(200).json({
      success: true,
      courses,
      selectionEnabled,
      maxSelectableCourses: selectionEnabled
        ? (plan.access?.courseSelection?.maxSelectableCourses || 3)
        : 0,
      total: courses.length,
      planTitle: plan.title,
    });
  } catch (error) {
    console.error('Error fetching plan eligible courses:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch eligible courses', error: error.message });
  }
};
