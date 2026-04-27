import { MembershipPlan } from '../../models/membershipPlan.models.js';
import { User } from '../../models/user.models.js';
import { UserMembership } from '../../models/userMembership.models.js';
import { CoursePlan } from '../../models/coursePlan.models.js';

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

const normalizeVariantPayload = (variant = {}, index = 0) => {
  const normalizedTitle = String(variant?.title || '').trim();
  const derivedSlugSource = variant?.slug || normalizedTitle || `variant-${index + 1}`;
  const normalizedSlug = normalizeSlug(derivedSlugSource);
  const useCustomPricingAndValidity = toBoolean(variant?.useCustomPricingAndValidity, false);

  const benefits = Array.isArray(variant?.benefits)
    ? variant.benefits
      .map((benefit) => ({
        text: String(benefit?.text || '').trim(),
        included: benefit?.included !== false,
      }))
      .filter((benefit) => benefit.text)
    : [];

  return {
    ...variant,
    title: normalizedTitle,
    slug: normalizedSlug,
    shortDescription: String(variant?.shortDescription || '').trim(),
    longDescription: String(variant?.longDescription || '').trim(),
    isActive: toBoolean(variant?.isActive, true),
    displayOrder: Number(variant?.displayOrder || 0),
    useCustomPricingAndValidity,
    customPricing: {
      amount: variant?.customPricing?.amount === undefined || variant?.customPricing?.amount === null
        ? null
        : Number(variant?.customPricing?.amount),
      currency: String(variant?.customPricing?.currency || 'INR').trim().toUpperCase(),
    },
    customValidityDays: variant?.customValidityDays === undefined || variant?.customValidityDays === null
      ? null
      : Number(variant?.customValidityDays),
    metadata: {
      badgeColor: variant?.metadata?.badgeColor ? String(variant.metadata.badgeColor).trim() : null,
      icon: variant?.metadata?.icon ? String(variant.metadata.icon).trim() : null,
      popular: toBoolean(variant?.metadata?.popular, false),
    },
    benefits,
  };
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

  if (payload.planVariantsEnabled !== undefined) {
    payload.planVariantsEnabled = toBoolean(payload.planVariantsEnabled, false);
  }

  if (payload.planVariants !== undefined) {
    payload.planVariants = Array.isArray(payload.planVariants)
      ? payload.planVariants.map((variant, index) => normalizeVariantPayload(variant, index))
      : [];
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
  if (Number.isNaN(validityDays) || validityDays < 1) {
    return 'validityDays must be at least 1';
  }

  const accessMode = payload.access?.accessMode;
  if (accessMode && !['entitlement_only', 'auto_enroll', 'hybrid'].includes(accessMode)) {
    return 'access.accessMode is invalid';
  }

  if (payload.planVariants !== undefined) {
    if (!Array.isArray(payload.planVariants)) {
      return 'planVariants must be an array';
    }

    const seenVariantSlugs = new Set();
    const parentSlug = normalizeSlug(payload.slug || '');

    for (let index = 0; index < payload.planVariants.length; index += 1) {
      const variant = payload.planVariants[index] || {};
      const title = String(variant.title || '').trim();
      const slug = normalizeSlug(variant.slug || title);

      if (!title) {
        return `planVariants[${index}].title is required`;
      }

      if (!slug) {
        return `planVariants[${index}].slug is required`;
      }

      if (slug === parentSlug) {
        return `planVariants[${index}].slug cannot be same as plan slug`;
      }

      if (seenVariantSlugs.has(slug)) {
        return `Duplicate variant slug: ${slug}`;
      }
      seenVariantSlugs.add(slug);

      const useCustomPricingAndValidity = Boolean(variant.useCustomPricingAndValidity);
      if (useCustomPricingAndValidity) {
        const customAmount = Number(variant?.customPricing?.amount);
        if (!Number.isFinite(customAmount) || customAmount < 0) {
          return `planVariants[${index}].customPricing.amount must be a non-negative number`;
        }

        const customValidityDays = Number(variant?.customValidityDays);
        if (!Number.isFinite(customValidityDays) || customValidityDays < 1) {
          return `planVariants[${index}].customValidityDays must be at least 1`;
        }
      }
    }
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
      planVariantsEnabled: payload.planVariantsEnabled ?? existingPlan.planVariantsEnabled,
      planVariants: payload.planVariants ?? existingPlan.planVariants,
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
      .select('title slug shortDescription longDescription pricing validityDays benefits metadata access planVariantsEnabled planVariants')
      .lean();

    const publicPlans = plans.map((plan) => {
      const variants = Array.isArray(plan?.planVariants)
        ? plan.planVariants.filter((variant) => variant && variant.isActive !== false)
        : [];

      return {
        ...plan,
        planVariantsEnabled: Boolean(plan?.planVariantsEnabled),
        planVariants: plan?.planVariantsEnabled ? variants : [],
      };
    });

    return res.status(200).json({
      success: true,
      data: publicPlans,
      total: publicPlans.length,
    });
  } catch (error) {
    console.error('Error fetching public membership plans:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch plans', error: error.message });
  }
};
