import { WellnessGoal } from '../../models/wellnessGoal.models.js';

const CATEGORIES = new Set([
  'physical', 'mental', 'emotional', 'spiritual',
  'financial', 'relationship', 'lifestyle', 'other',
]);

const STATUSES = new Set(['active', 'completed', 'paused']);

const toNumber = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const parseDate = (value, fallback = null) => {
  if (value === undefined) return fallback;
  if (value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatGoal = (goal) => {
  const target = Number(goal.targetValue) || 0;
  const current = Number(goal.currentValue) || 0;
  const progressPercent = target > 0
    ? Math.min(100, Math.max(0, Math.round((current / target) * 100)))
    : (goal.status === 'completed' ? 100 : 0);

  const now = new Date();
  const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
  const daysRemaining = targetDate
    ? Math.ceil((targetDate.getTime() - now.getTime()) / 86400000)
    : null;

  return {
    ...goal,
    progressPercent,
    daysRemaining,
    isOverdue: Boolean(targetDate && daysRemaining < 0 && goal.status !== 'completed'),
  };
};

const evaluateBadges = async (userId) => {
  try {
    const { unlockBadgesForUser } = await import('../../services/badgeUnlockingService.js');
    await unlockBadgesForUser(userId);
  } catch (error) {
    console.error('Wellness goal badge evaluation failed:', error?.message);
  }
};

const validateGoalPayload = (body, existing = null) => {
  const title = body.title !== undefined
    ? String(body.title || '').trim()
    : existing?.title;
  const description = body.description !== undefined
    ? String(body.description || '').trim()
    : (existing?.description || '');
  const category = body.category !== undefined
    ? String(body.category || '').trim().toLowerCase()
    : (existing?.category || 'other');
  const targetValue = body.targetValue !== undefined
    ? toNumber(body.targetValue)
    : Number(existing?.targetValue);
  const currentValue = body.currentValue !== undefined
    ? toNumber(body.currentValue, 0)
    : Number(existing?.currentValue || 0);
  const unit = body.unit !== undefined
    ? String(body.unit || '').trim()
    : (existing?.unit || '');

  const startDate = parseDate(body.startDate, existing?.startDate || new Date());
  const targetDate = parseDate(body.targetDate, existing?.targetDate || null);

  if (!title || title.length < 3) {
    return { error: 'Goal title must be at least 3 characters' };
  }
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    return { error: 'Target value must be greater than 0' };
  }
  if (!Number.isFinite(currentValue) || currentValue < 0) {
    return { error: 'Current value cannot be negative' };
  }
  if (!CATEGORIES.has(category)) {
    return { error: 'Invalid goal category' };
  }
  if (targetDate && startDate && targetDate < startDate) {
    return { error: 'Target date cannot be before the start date' };
  }

  return {
    value: {
      title,
      description,
      category,
      targetValue,
      currentValue,
      unit,
      startDate: startDate || new Date(),
      targetDate,
    },
  };
};

/**
 * List wellness goals for the current user.
 * GET /api/wellness-goals
 */
export const listWellnessGoals = async (req, res) => {
  try {
    const status = String(req.query.status || 'all').toLowerCase();
    const query = { userId: req.user._id };
    if (STATUSES.has(status)) query.status = status;

    const goals = await WellnessGoal.find(query)
      .sort({ status: 1, targetDate: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      goals: goals.map(formatGoal),
    });
  } catch (error) {
    console.error('List Wellness Goals Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load wellness goals',
      error: error.message,
    });
  }
};

/**
 * Create a wellness goal.
 * POST /api/wellness-goals
 */
export const createWellnessGoal = async (req, res) => {
  try {
    const validated = validateGoalPayload(req.body);
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    const goal = new WellnessGoal({
      ...validated.value,
      userId: req.user._id,
      status: 'active',
    });
    goal.refreshCompletionState();
    await goal.save();

    await evaluateBadges(req.user._id);

    return res.status(201).json({
      success: true,
      message: 'Wellness goal created',
      goal: formatGoal(goal.toObject()),
    });
  } catch (error) {
    console.error('Create Wellness Goal Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create wellness goal',
      error: error.message,
    });
  }
};

/**
 * Update a wellness goal.
 * PATCH /api/wellness-goals/:id
 */
export const updateWellnessGoal = async (req, res) => {
  try {
    const goal = await WellnessGoal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Wellness goal not found' });
    }

    const validated = validateGoalPayload(req.body, goal.toObject());
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    const previousCurrent = Number(goal.currentValue) || 0;
    Object.assign(goal, validated.value);

    if (req.body.status !== undefined) {
      const nextStatus = String(req.body.status || '').toLowerCase();
      if (!STATUSES.has(nextStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid goal status' });
      }
      goal.status = nextStatus;
      if (nextStatus === 'completed') {
        goal.currentValue = Number(goal.targetValue) || goal.currentValue;
        goal.lastProgressAt = new Date();
        goal.completedAt = goal.completedAt || new Date();
      } else if (nextStatus === 'active') {
        goal.completedAt = null;
      }
    } else {
      goal.refreshCompletionState();
    }

    if (Number(goal.currentValue) !== previousCurrent) {
      goal.lastProgressAt = new Date();
    }

    await goal.save();
    await evaluateBadges(req.user._id);

    return res.status(200).json({
      success: true,
      message: 'Wellness goal updated',
      goal: formatGoal(goal.toObject()),
    });
  } catch (error) {
    console.error('Update Wellness Goal Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update wellness goal',
      error: error.message,
    });
  }
};

/**
 * Update goal progress.
 * PATCH /api/wellness-goals/:id/progress
 */
export const updateWellnessGoalProgress = async (req, res) => {
  try {
    const goal = await WellnessGoal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Wellness goal not found' });
    }

    const currentValue = toNumber(req.body.currentValue);
    if (!Number.isFinite(currentValue) || currentValue < 0) {
      return res.status(400).json({ success: false, message: 'Current value must be zero or greater' });
    }

    goal.currentValue = currentValue;
    goal.lastProgressAt = new Date();
    goal.refreshCompletionState();
    await goal.save();

    await evaluateBadges(req.user._id);

    return res.status(200).json({
      success: true,
      message: 'Goal progress updated',
      goal: formatGoal(goal.toObject()),
    });
  } catch (error) {
    console.error('Update Wellness Goal Progress Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update goal progress',
      error: error.message,
    });
  }
};

/**
 * Delete a wellness goal.
 * DELETE /api/wellness-goals/:id
 */
export const deleteWellnessGoal = async (req, res) => {
  try {
    const goal = await WellnessGoal.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!goal) {
      return res.status(404).json({ success: false, message: 'Wellness goal not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Wellness goal deleted',
    });
  } catch (error) {
    console.error('Delete Wellness Goal Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete wellness goal',
      error: error.message,
    });
  }
};
