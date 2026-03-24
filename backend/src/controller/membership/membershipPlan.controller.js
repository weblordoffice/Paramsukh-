import { MembershipPlan } from '../../models/membershipPlan.models.js';

const ALLOWED_COURSE_CATEGORIES = ['physical', 'mental', 'financial', 'relationship', 'spiritual', 'general'];

const normalizeSlug = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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

  if (payload.access?.includedCategories && Array.isArray(payload.access.includedCategories)) {
    const rawCategories = payload.access.includedCategories
      .map((cat) => String(cat || '').trim().toLowerCase())
      .filter(Boolean);
    
    // Silently remove duplicates to prevent the 400 Bad Request error
    payload.access.includedCategories = [...new Set(rawCategories)];
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
  if (Number.isNaN(validityDays) || validityDays < 1) {
    return 'validityDays must be at least 1';
  }

  const includedCategories = payload.access?.includedCategories || [];
  const invalidCategories = includedCategories.filter((cat) => !ALLOWED_COURSE_CATEGORIES.includes(cat));
  if (invalidCategories.length > 0) {
    return `Invalid categories: ${invalidCategories.join(', ')}`;
  }

  const uniqueCategories = new Set(includedCategories);
  if (uniqueCategories.size !== includedCategories.length) {
    return 'includedCategories cannot contain duplicates';
  }

  const maxCategories = payload.access?.limits?.maxCategories;
  if (maxCategories !== null && maxCategories !== undefined) {
    const parsed = Number(maxCategories);
    if (Number.isNaN(parsed) || parsed < 1) {
      return 'access.limits.maxCategories must be at least 1 when provided';
    }
    if (includedCategories.length > 0 && parsed > includedCategories.length) {
      return 'access.limits.maxCategories cannot exceed includedCategories count';
    }
  }

  const maxCoursesTotal = payload.access?.limits?.maxCoursesTotal;
  if (maxCoursesTotal !== null && maxCoursesTotal !== undefined) {
    const parsed = Number(maxCoursesTotal);
    if (Number.isNaN(parsed) || parsed < 1) {
      return 'access.limits.maxCoursesTotal must be at least 1 when provided';
    }
  }

  const perCategoryCourseLimit = payload.access?.limits?.perCategoryCourseLimit;
  if (perCategoryCourseLimit !== null && perCategoryCourseLimit !== undefined) {
    const parsed = Number(perCategoryCourseLimit);
    if (Number.isNaN(parsed) || parsed < 1) {
      return 'access.limits.perCategoryCourseLimit must be at least 1 when provided';
    }

    if (maxCoursesTotal !== null && maxCoursesTotal !== undefined && parsed > Number(maxCoursesTotal)) {
      return 'access.limits.perCategoryCourseLimit cannot exceed maxCoursesTotal';
    }
  }

  const accessMode = payload.access?.accessMode;
  if (accessMode && !['entitlement_only', 'auto_enroll', 'hybrid'].includes(accessMode)) {
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

export const listMembershipPlansPublic = async (req, res) => {
  try {
    const plans = await MembershipPlan.find({ status: 'published' })
      .sort({ displayOrder: 1, createdAt: -1 })
      .select('title slug shortDescription longDescription pricing validityDays benefits metadata access');

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
