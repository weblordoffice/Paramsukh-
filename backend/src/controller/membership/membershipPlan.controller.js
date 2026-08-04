import { MembershipPlan } from '../../models/membershipPlan.models.js';
import { User } from '../../models/user.models.js';
import { UserMembership } from '../../models/userMembership.models.js';
import { CoursePlan } from '../../models/coursePlan.models.js';
import { Course } from '../../models/course.models.js';

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

const sanitizePlanPayload = (body = {}) => {
  const payload = { ...body };

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

    // Feature removed: keep these neutral regardless of incoming payload.
    payload.access.includedCourseIds = [];
    payload.access.limits = {
      maxCategories: null,
      maxCoursesTotal: null,
      perCategoryCourseLimit: null,
    };
  }

  if (payload.access?.inheritedPlanIds && Array.isArray(payload.access.inheritedPlanIds)) {
    payload.access.inheritedPlanIds = [...new Set(payload.access.inheritedPlanIds.filter(Boolean).map(String))];
  }

  if (payload.shortDescription !== undefined) {
    payload.shortDescription = String(payload.shortDescription || '').trim();
  }

  if (payload.longDescription !== undefined) {
    payload.longDescription = String(payload.longDescription || '').trim();
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

    const plans = await MembershipPlan.find(query).sort({ displayOrder: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: plans,
      total: plans.length,
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

    Object.assign(existingPlan, mergedPayload);
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

export const deleteMembershipPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await MembershipPlan.findById(id);

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Membership plan not found' });
    }

    const slug = normalizeSlug(plan.slug);

    // Prevent deleting plans currently assigned to users.
    const assignedUsers = await User.countDocuments({ subscriptionPlan: slug });
    if (assignedUsers > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete "${plan.title}" because ${assignedUsers} user(s) are currently assigned to it. Archive it instead.`,
      });
    }

    // Prevent deleting plans with active membership grants.
    const activeMemberships = await UserMembership.countDocuments({
      planId: plan._id,
      status: 'active',
      endDate: { $gte: new Date() },
    });
    if (activeMemberships > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete "${plan.title}" because it has ${activeMemberships} active membership record(s).`,
      });
    }

    // Remove this plan from inheritance chains and course-plan mappings.
    await Promise.all([
      MembershipPlan.updateMany(
        { 'access.inheritedPlanIds': plan._id },
        { $pull: { 'access.inheritedPlanIds': plan._id } }
      ),
      CoursePlan.deleteMany({ planId: plan._id }),
    ]);

    await MembershipPlan.findByIdAndDelete(plan._id);

    return res.status(200).json({
      success: true,
      message: 'Membership plan deleted successfully',
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

    return res.status(200).json({
      success: true,
      data: plans,
      total: plans.length,
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

    if (!plan.access?.courseSelection?.enabled) {
      return res.status(200).json({
        success: true,
        courses: [],
        maxSelectableCourses: 0,
        message: 'Course selection not enabled for this plan',
      });
    }

    const selectionConfig = plan.access.courseSelection;
    const mode = selectionConfig.eligibleCoursesMode || 'all_published';
    const eligibleCategories = (selectionConfig.eligibleCategories || []).map((c) => normalizeSlug(c));
    const eligibleCourseIds = (selectionConfig.eligibleCourseIds || []).map((id) => String(id));

    let courseQuery = { status: 'published' };

    if (mode === 'specific' && eligibleCourseIds.length > 0) {
      courseQuery._id = { $in: eligibleCourseIds };
    } else if (mode === 'categories' && eligibleCategories.length > 0) {
      courseQuery.category = { $in: eligibleCategories };
    } else {
      const planCourseIds = new Set(eligibleCourseIds);
      const junctionMappings = await CoursePlan.find({ planId: plan._id }).lean();
      junctionMappings.forEach((m) => planCourseIds.add(String(m.courseId)));

      const legacyCourses = await Course.find({ includedInPlans: slug, status: 'published' }).select('_id').lean();
      legacyCourses.forEach((c) => planCourseIds.add(String(c._id)));

      if (plan.access?.includedCourseIds?.length) {
        plan.access.includedCourseIds.forEach((id) => planCourseIds.add(String(id)));
      }

      if (plan.access?.includedCategories?.length) {
        const catCourses = await Course.find({
          status: 'published',
          category: { $in: plan.access.includedCategories.map((c) => normalizeSlug(c)) },
        }).select('_id').lean();
        catCourses.forEach((c) => planCourseIds.add(String(c._id)));
      }

      const resolvedIds = Array.from(planCourseIds).filter(Boolean);
      if (resolvedIds.length > 0) {
        courseQuery._id = { $in: resolvedIds };
      }
    }

    const courses = await Course.find(courseQuery)
      .select('title description shortDescription thumbnailUrl bannerUrl icon color duration category tags totalVideos totalPdfs status')
      .sort({ title: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      courses,
      maxSelectableCourses: selectionConfig.maxSelectableCourses || 3,
      planTitle: plan.title,
    });
  } catch (error) {
    console.error('Error fetching plan eligible courses:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch eligible courses', error: error.message });
  }
};
