import { LiveCoachingSession } from '../../models/liveSession.models.js';
import { getUserEntitlementContext } from '../../services/entitlement.service.js';

const ALLOWED_PLATFORMS = new Set(['zoom', 'google-meet', 'teams', 'other']);
const ALLOWED_AUDIENCES = new Set(['all', 'plans']);
const ALLOWED_STATUSES = new Set(['scheduled', 'completed', 'cancelled']);

const normalizePlanSlug = (value) => String(value || '').trim().toLowerCase();

const normalizePlatform = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ALLOWED_PLATFORMS.has(normalized) ? normalized : 'zoom';
};

const normalizeStatus = (value, fallback = 'scheduled') => {
  const normalized = String(value || '').trim().toLowerCase();
  return ALLOWED_STATUSES.has(normalized) ? normalized : fallback;
};

const normalizePlanSlugs = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value.map(normalizePlanSlug).filter(Boolean)
  )];
};

const getSessionEndMs = (session) => {
  return new Date(session.scheduledAt).getTime() + Number(session.durationInMinutes || 0) * 60000;
};

const isPastSession = (session, now = Date.now()) => {
  if (session.status === 'completed') return true;
  return getSessionEndMs(session) < now;
};

const isAuthorizedForSession = (session, planSlugs) => {
  if (session.audienceType === 'all') return true;
  if (session.audienceType !== 'plans') return false;
  const allowed = new Set((session.planSlugs || []).map(normalizePlanSlug));
  return planSlugs.some((slug) => allowed.has(slug));
};

const validatePayload = (body) => {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const meetingLink = String(body.meetingLink || '').trim();
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const durationInMinutes = Number(body.durationInMinutes);
  const audienceType = ALLOWED_AUDIENCES.has(String(body.audienceType || '').toLowerCase())
    ? String(body.audienceType).toLowerCase()
    : 'all';
  const planSlugs = normalizePlanSlugs(body.planSlugs);

  if (!title) return { error: 'Title is required' };
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return { error: 'A valid date and time is required' };
  if (!Number.isFinite(durationInMinutes) || durationInMinutes <= 0) return { error: 'Duration must be greater than 0' };
  if (!meetingLink) return { error: 'Meeting link is required' };
  if (audienceType === 'plans' && planSlugs.length === 0) {
    return { error: 'Select at least one membership plan' };
  }

  return {
    value: {
      title,
      description,
      scheduledAt,
      durationInMinutes: Math.round(durationInMinutes),
      meetingPlatform: normalizePlatform(body.meetingPlatform),
      meetingLink,
      audienceType,
      planSlugs: audienceType === 'plans' ? planSlugs : [],
      recordingUrl: body.recordingUrl ? String(body.recordingUrl).trim() : null,
      status: normalizeStatus(body.status),
    },
  };
};

/**
 * List live sessions visible to the current user, split into upcoming and past.
 * GET /api/live-sessions
 */
export const listLiveSessions = async (req, res) => {
  try {
    const entitlement = await getUserEntitlementContext(req.user._id);
    const planSlugs = (entitlement?.planSlugs || ['free']).map(normalizePlanSlug);

    const sessions = await LiveCoachingSession.find({
      status: { $ne: 'cancelled' },
      $or: [
        { audienceType: 'all' },
        { audienceType: 'plans', planSlugs: { $in: planSlugs } },
      ],
    })
      .sort({ scheduledAt: 1 })
      .lean();

    const now = Date.now();
    const upcoming = [];
    const past = [];

    sessions.forEach((session) => {
      if (isPastSession(session, now)) {
        past.push(session);
      } else {
        upcoming.push(session);
      }
    });

    upcoming.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    past.sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));

    return res.status(200).json({
      success: true,
      upcoming,
      past,
    });
  } catch (error) {
    console.error('List Live Sessions Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load live sessions',
      error: error.message,
    });
  }
};

/**
 * Get a single live session if the user is eligible.
 * GET /api/live-sessions/:id
 */
export const getLiveSession = async (req, res) => {
  try {
    const entitlement = await getUserEntitlementContext(req.user._id);
    const planSlugs = (entitlement?.planSlugs || ['free']).map(normalizePlanSlug);

    const session = await LiveCoachingSession.findById(req.params.id).lean();
    if (!session || session.status === 'cancelled' || !isAuthorizedForSession(session, planSlugs)) {
      return res.status(404).json({ success: false, message: 'Live session not found' });
    }

    return res.status(200).json({ success: true, session });
  } catch (error) {
    console.error('Get Live Session Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load live session',
      error: error.message,
    });
  }
};

/**
 * Admin: list all live sessions.
 * GET /api/live-sessions/admin/all
 */
export const listAdminLiveSessions = async (req, res) => {
  try {
    const sessions = await LiveCoachingSession.find({})
      .sort({ scheduledAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: sessions });
  } catch (error) {
    console.error('List Admin Live Sessions Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load live sessions',
      error: error.message,
    });
  }
};

/**
 * Admin: create a live session.
 * POST /api/live-sessions/admin
 */
export const createLiveSession = async (req, res) => {
  try {
    const validated = validatePayload(req.body);
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    const session = await LiveCoachingSession.create({
      ...validated.value,
      createdBy: req.admin?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Live session created successfully',
      data: session,
    });
  } catch (error) {
    console.error('Create Live Session Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create live session',
      error: error.message,
    });
  }
};

/**
 * Admin: update a live session.
 * PATCH /api/live-sessions/admin/:id
 */
export const updateLiveSession = async (req, res) => {
  try {
    const session = await LiveCoachingSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Live session not found' });
    }

    const validated = validatePayload({ ...session.toObject(), ...req.body });
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    Object.assign(session, validated.value);
    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Live session updated successfully',
      data: session,
    });
  } catch (error) {
    console.error('Update Live Session Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update live session',
      error: error.message,
    });
  }
};

/**
 * Admin: delete a live session.
 * DELETE /api/live-sessions/admin/:id
 */
export const deleteLiveSession = async (req, res) => {
  try {
    const session = await LiveCoachingSession.findByIdAndDelete(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Live session not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Live session deleted successfully',
    });
  } catch (error) {
    console.error('Delete Live Session Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete live session',
      error: error.message,
    });
  }
};

