import { LiveCoachingSession } from '../../models/liveSession.models.js';
import { LiveSessionRegistration } from '../../models/liveSessionRegistration.models.js';
import { getUserEntitlementContext } from '../../services/entitlement.service.js';
import { createZoomMeeting, isZoomConfigured } from '../../services/zoomService.js';
import Notification from '../../models/notification.models.js';
import { sendPushToUser } from '../../services/pushService.js';

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

const getUserPlanSlugs = async (userId) => {
  const entitlement = await getUserEntitlementContext(userId);
  return (entitlement?.planSlugs || ['free']).map(normalizePlanSlug);
};

const validatePayload = (body, { requireMeetingLink = true } = {}) => {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const meetingLink = String(body.meetingLink || '').trim();
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const durationInMinutes = Number(body.durationInMinutes);
  const audienceType = ALLOWED_AUDIENCES.has(String(body.audienceType || '').toLowerCase())
    ? String(body.audienceType).toLowerCase()
    : 'all';
  const planSlugs = normalizePlanSlugs(body.planSlugs);
  const capacityValue = body.capacity === undefined || body.capacity === null || body.capacity === ''
    ? null
    : Number(body.capacity);

  if (!title) return { error: 'Title is required' };
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return { error: 'A valid date and time is required' };
  if (!Number.isFinite(durationInMinutes) || durationInMinutes <= 0) return { error: 'Duration must be greater than 0' };
  if (requireMeetingLink && !meetingLink) return { error: 'Meeting link is required' };
  if (audienceType === 'plans' && planSlugs.length === 0) {
    return { error: 'Select at least one membership plan' };
  }
  if (capacityValue !== null && (!Number.isFinite(capacityValue) || capacityValue < 1)) {
    return { error: 'Capacity must be a positive number' };
  }

  return {
    value: {
      title,
      description,
      scheduledAt,
      durationInMinutes: Math.round(durationInMinutes),
      meetingPlatform: normalizePlatform(body.meetingPlatform),
      meetingLink,
      meetingPassword: body.meetingPassword ? String(body.meetingPassword).trim() : null,
      zoomMeetingId: body.zoomMeetingId ? String(body.zoomMeetingId).trim() : null,
      capacity: capacityValue,
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
    const planSlugs = await getUserPlanSlugs(req.user._id);

    const sessions = await LiveCoachingSession.find({
      status: { $ne: 'cancelled' },
      $or: [
        { audienceType: 'all' },
        { audienceType: 'plans', planSlugs: { $in: planSlugs } },
      ],
    })
      .sort({ scheduledAt: 1 })
      .lean();

    const registrations = await LiveSessionRegistration.find({
      userId: req.user._id,
      sessionId: { $in: sessions.map((session) => session._id) },
      status: 'registered',
    }).select('sessionId').lean();
    const registeredIds = new Set(registrations.map((registration) => String(registration.sessionId)));

    const now = Date.now();
    const upcoming = [];
    const past = [];

    sessions.forEach((session) => {
      const decorated = {
        ...session,
        isRegistered: registeredIds.has(String(session._id)),
        isFull: Boolean(session.capacity && session.registrationCount >= session.capacity),
      };
      if (isPastSession(session, now)) {
        past.push(decorated);
      } else {
        upcoming.push(decorated);
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
    const planSlugs = await getUserPlanSlugs(req.user._id);

    const session = await LiveCoachingSession.findById(req.params.id).lean();
    if (!session || session.status === 'cancelled' || !isAuthorizedForSession(session, planSlugs)) {
      return res.status(404).json({ success: false, message: 'Live session not found' });
    }

    const registration = await LiveSessionRegistration.findOne({
      sessionId: session._id,
      userId: req.user._id,
      status: 'registered',
    }).select('_id').lean();

    return res.status(200).json({
      success: true,
      session: {
        ...session,
        isRegistered: Boolean(registration),
        isFull: Boolean(session.capacity && session.registrationCount >= session.capacity),
      },
    });
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
 * Register for a live session.
 * POST /api/live-sessions/:id/register
 */
export const registerForLiveSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const session = await LiveCoachingSession.findById(req.params.id);
    if (!session || session.status === 'cancelled') {
      return res.status(404).json({ success: false, message: 'Live session not found' });
    }

    const planSlugs = await getUserPlanSlugs(userId);
    if (!isAuthorizedForSession(session, planSlugs)) {
      return res.status(403).json({ success: false, message: 'You are not eligible for this session' });
    }

    if (isPastSession(session)) {
      return res.status(400).json({ success: false, message: 'This session has already ended' });
    }

    const existing = await LiveSessionRegistration.findOne({ sessionId: session._id, userId });
    if (existing?.status === 'registered') {
      return res.status(200).json({
        success: true,
        message: 'You are already registered for this session',
        registration: existing,
        registrationCount: session.registrationCount,
      });
    }

    const reservedSession = await LiveCoachingSession.findOneAndUpdate(
      {
        _id: session._id,
        $or: [
          { capacity: null },
          { $expr: { $lt: ['$registrationCount', '$capacity'] } },
        ],
      },
      { $inc: { registrationCount: 1 } },
      { new: true }
    ).select('registrationCount capacity');

    if (!reservedSession) {
      return res.status(400).json({ success: false, message: 'This session is full' });
    }

    let registration;
    try {
      registration = await LiveSessionRegistration.findOneAndUpdate(
        { sessionId: session._id, userId },
        {
          $set: {
            status: 'registered',
            registeredAt: new Date(),
            cancelledAt: null,
            reminder24SentAt: null,
            reminder1SentAt: null,
          },
          $setOnInsert: { sessionId: session._id, userId },
        },
        { upsert: true, new: true }
      );
    } catch (registrationError) {
      await LiveCoachingSession.findByIdAndUpdate(session._id, { $inc: { registrationCount: -1 } });
      throw registrationError;
    }

    const updatedSession = reservedSession;

    const when = new Date(session.scheduledAt).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    try {
      await Notification.createNotification({
        user: userId,
        type: 'live_session_registered',
        title: 'Live session registration confirmed',
        message: `You're registered for "${session.title}" on ${when}.`,
        relatedId: session._id,
        actionUrl: '/(home)/live-sessions',
        icon: '🎥',
      });
      await sendPushToUser(userId, {
        title: 'Live session registration confirmed',
        body: `You're registered for "${session.title}" on ${when}.`,
        data: { type: 'live_session_registered', actionUrl: '/(home)/live-sessions' },
      });
    } catch (notificationError) {
      console.error('Live session registration notification failed:', notificationError?.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Registered for the live session',
      registration,
      registrationCount: updatedSession?.registrationCount || 0,
      capacity: updatedSession?.capacity || null,
    });
  } catch (error) {
    console.error('Register Live Session Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register for live session',
      error: error.message,
    });
  }
};

/**
 * Cancel a live-session registration.
 * DELETE /api/live-sessions/:id/register
 */
export const cancelLiveSessionRegistration = async (req, res) => {
  try {
    const userId = req.user._id;
    const registration = await LiveSessionRegistration.findOne({
      sessionId: req.params.id,
      userId,
      status: 'registered',
    });

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    registration.status = 'cancelled';
    registration.cancelledAt = new Date();
    await registration.save();

    await LiveCoachingSession.findOneAndUpdate(
      { _id: req.params.id, registrationCount: { $gt: 0 } },
      { $inc: { registrationCount: -1 } }
    );

    return res.status(200).json({
      success: true,
      message: 'Registration cancelled',
    });
  } catch (error) {
    console.error('Cancel Live Session Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel registration',
      error: error.message,
    });
  }
};

/**
 * Get the current user's live-session registrations.
 * GET /api/live-sessions/my-registrations
 */
export const getMyLiveSessionRegistrations = async (req, res) => {
  try {
    const registrations = await LiveSessionRegistration.find({
      userId: req.user._id,
      status: 'registered',
    })
      .populate('sessionId')
      .sort({ registeredAt: -1 })
      .lean();

    const active = registrations.filter((item) => item.sessionId && item.sessionId.status !== 'cancelled');

    return res.status(200).json({
      success: true,
      registrations: active.map((item) => ({
        registration: {
          _id: item._id,
          registeredAt: item.registeredAt,
        },
        session: {
          ...item.sessionId,
          isRegistered: true,
        },
      })),
    });
  } catch (error) {
    console.error('Get My Live Session Registrations Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load registrations',
      error: error.message,
    });
  }
};

const escapeIcs = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const formatIcsDate = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

/**
 * Download an ICS calendar event for a live session.
 * GET /api/live-sessions/:id/calendar.ics
 */
export const downloadLiveSessionCalendar = async (req, res) => {
  try {
    const session = await LiveCoachingSession.findById(req.params.id).lean();
    if (!session || session.status === 'cancelled') {
      return res.status(404).send('Live session not found');
    }

    const start = new Date(session.scheduledAt);
    const end = new Date(start.getTime() + Number(session.durationInMinutes || 60) * 60000);
    const descriptionLines = [
      session.description || '',
      session.meetingLink ? `Join: ${session.meetingLink}` : '',
      session.meetingPassword ? `Password: ${session.meetingPassword}` : '',
    ].filter(Boolean).join('\n');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ParamSukh//Live Sessions//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${session._id}@paramsukh`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcs(session.title)}`,
      `DESCRIPTION:${escapeIcs(descriptionLines)}`,
      `LOCATION:${escapeIcs(session.meetingLink || 'Online')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="live-session-${session._id}.ics"`);
    return res.status(200).send(ics);
  } catch (error) {
    console.error('Download Live Session Calendar Error:', error);
    return res.status(500).send('Failed to generate calendar file');
  }
};

/**
 * Admin: Zoom integration status.
 * GET /api/live-sessions/admin/config
 */
export const getLiveSessionConfig = async (req, res) => {
  return res.status(200).json({
    success: true,
    zoomConfigured: isZoomConfigured(),
  });
};

/**
 * Admin: list registrations for a session.
 * GET /api/live-sessions/admin/:id/registrations
 */
export const listSessionRegistrationsAdmin = async (req, res) => {
  try {
    const registrations = await LiveSessionRegistration.find({
      sessionId: req.params.id,
      status: 'registered',
    })
      .populate('userId', 'displayName email phone')
      .sort({ registeredAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      registrations,
      total: registrations.length,
    });
  } catch (error) {
    console.error('List Session Registrations Admin Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load registrations',
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
    const autoCreateZoomMeeting = req.body.autoCreateZoomMeeting === true
      && normalizePlatform(req.body.meetingPlatform) === 'zoom';
    const validated = validatePayload(req.body, { requireMeetingLink: !autoCreateZoomMeeting });
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    if (autoCreateZoomMeeting) {
      try {
        const meeting = await createZoomMeeting({
          topic: validated.value.title,
          startTime: validated.value.scheduledAt,
          durationInMinutes: validated.value.durationInMinutes,
          agenda: validated.value.description,
        });
        validated.value.meetingLink = meeting.meetingLink;
        validated.value.meetingPassword = meeting.meetingPassword;
        validated.value.zoomMeetingId = meeting.zoomMeetingId;
      } catch (zoomError) {
        return res.status(502).json({
          success: false,
          message: `Could not create Zoom meeting: ${zoomError.message}`,
        });
      }
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

    const autoCreateZoomMeeting = req.body.autoCreateZoomMeeting === true
      && normalizePlatform(req.body.meetingPlatform || session.meetingPlatform) === 'zoom';
    const validated = validatePayload(
      { ...session.toObject(), ...req.body },
      { requireMeetingLink: !autoCreateZoomMeeting }
    );
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    if (autoCreateZoomMeeting) {
      try {
        const meeting = await createZoomMeeting({
          topic: validated.value.title,
          startTime: validated.value.scheduledAt,
          durationInMinutes: validated.value.durationInMinutes,
          agenda: validated.value.description,
        });
        validated.value.meetingLink = meeting.meetingLink;
        validated.value.meetingPassword = meeting.meetingPassword;
        validated.value.zoomMeetingId = meeting.zoomMeetingId;
      } catch (zoomError) {
        return res.status(502).json({
          success: false,
          message: `Could not create Zoom meeting: ${zoomError.message}`,
        });
      }
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

    await LiveSessionRegistration.deleteMany({ sessionId: req.params.id });

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

