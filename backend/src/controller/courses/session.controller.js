import { Course } from '../../models/course.models.js';

const ALLOWED_MEETING_PLATFORMS = new Set(['zoom', 'google-meet', 'teams', 'other']);
const ALLOWED_SESSION_STATUSES = new Set(['scheduled', 'completed', 'cancelled']);

const toPositiveInteger = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
};

const normalizeMeetingPlatform = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (ALLOWED_MEETING_PLATFORMS.has(normalized)) return normalized;
  return 'other';
};

/**
 * Add live session to course
 * POST /api/courses/:courseId/livesessions
 */
export const addLiveSessionToCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { 
      title, 
      description, 
      scheduledAt, 
      durationInMinutes, 
      duration,
      meetingPlatform, 
      meetingLink,
      resources,
      status
    } = req.body;

    const resolvedDurationInMinutes = toPositiveInteger(durationInMinutes ?? duration, 0);
    const resolvedMeetingPlatform = normalizeMeetingPlatform(meetingPlatform);
    const resolvedStatus = ALLOWED_SESSION_STATUSES.has(String(status || '').trim().toLowerCase())
      ? String(status).trim().toLowerCase()
      : 'scheduled';

    // Validate required fields
    if (!title || !scheduledAt || !resolvedDurationInMinutes || !meetingLink) {
      return res.status(400).json({
        success: false,
        message: "Required fields: title, scheduledAt, durationInMinutes (or duration), meetingLink"
      });
    }

    // Find course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    // Create live session object
    const liveSession = {
      title,
      description,
      scheduledAt: new Date(scheduledAt),
      durationInMinutes: resolvedDurationInMinutes,
      meetingPlatform: resolvedMeetingPlatform,
      meetingLink,
      resources: resources || [],
      status: resolvedStatus
    };

    // Add to course
    course.liveSessions.push(liveSession);
    await course.save();

    // Get the newly added session
    const addedSession = course.liveSessions[course.liveSessions.length - 1];

    console.log(`✅ Live session added to course: ${course.title}`);

    return res.status(201).json({
      success: true,
      message: "Live session added successfully",
      liveSession: addedSession
    });

  } catch (error) {
    console.error("❌ Error adding live session:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get all live sessions for a course
 * GET /api/courses/:courseId/livesessions
 */
export const getCourseLiveSessions = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { status, upcoming } = req.query;

    const course = await Course.findById(courseId).select('title liveSessions');
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    let sessions = course.liveSessions;

    // Filter by status
    if (status) {
      sessions = sessions.filter(s => s.status === status);
    }

    // Filter upcoming sessions
    if (upcoming === 'true') {
      const now = new Date();
      sessions = sessions.filter(s => new Date(s.scheduledAt) > now);
    }

    // Sort by scheduled date
    sessions.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    return res.status(200).json({
      success: true,
      message: "Live sessions fetched successfully",
      courseTitle: course.title,
      liveSessions: sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error("❌ Error fetching live sessions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get specific live session
 * GET /api/courses/:courseId/livesessions/:liveSessionId
 */
export const getLiveSessionById = async (req, res) => {
  try {
    const { courseId, liveSessionId } = req.params;

    const course = await Course.findById(courseId).select('title liveSessions');
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    const liveSession = course.liveSessions.id(liveSessionId);
    if (!liveSession) {
      return res.status(404).json({
        success: false,
        message: "Live session not found"
      });
    }

    // Check if session is upcoming, ongoing, or past
    const now = new Date();
    const sessionStart = new Date(liveSession.scheduledAt);
    const sessionEnd = new Date(sessionStart.getTime() + liveSession.durationInMinutes * 60000);

    let sessionStatus = 'scheduled';
    if (now >= sessionStart && now <= sessionEnd) {
      sessionStatus = 'ongoing';
    } else if (now > sessionEnd) {
      sessionStatus = 'completed';
    }

    return res.status(200).json({
      success: true,
      message: "Live session fetched successfully",
      courseTitle: course.title,
      liveSession,
      currentStatus: sessionStatus,
      canJoin: sessionStatus === 'ongoing' || (sessionStart - now <= 10 * 60000) // Can join 10 min before
    });

  } catch (error) {
    console.error("❌ Error fetching live session:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update live session
 * PUT /api/courses/:courseId/livesessions/:liveSessionId
 */
export const updateLiveSession = async (req, res) => {
  try {
    const { courseId, liveSessionId } = req.params;
    const updateData = { ...req.body };
    if (updateData.durationInMinutes === undefined && updateData.duration !== undefined) {
      updateData.durationInMinutes = updateData.duration;
    }
    if (updateData.meetingPlatform !== undefined) {
      updateData.meetingPlatform = normalizeMeetingPlatform(updateData.meetingPlatform);
    }
    if (updateData.status !== undefined) {
      const normalizedStatus = String(updateData.status).trim().toLowerCase();
      updateData.status = ALLOWED_SESSION_STATUSES.has(normalizedStatus)
        ? normalizedStatus
        : 'scheduled';
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    const liveSession = course.liveSessions.id(liveSessionId);
    if (!liveSession) {
      return res.status(404).json({
        success: false,
        message: "Live session not found"
      });
    }

    // Update fields
    const allowedFields = [
      'title', 'description', 'scheduledAt', 'durationInMinutes',
      'meetingPlatform', 'meetingLink', 'recordingUrl', 'resources', 'status'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'scheduledAt') {
          liveSession[field] = new Date(updateData[field]);
        } else if (field === 'durationInMinutes') {
          liveSession[field] = toPositiveInteger(updateData[field], liveSession.durationInMinutes || 60);
        } else {
          liveSession[field] = updateData[field];
        }
      }
    });

    await course.save();

    console.log(`✅ Live session updated: ${liveSession.title}`);

    return res.status(200).json({
      success: true,
      message: "Live session updated successfully",
      liveSession
    });

  } catch (error) {
    console.error("❌ Error updating live session:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Delete live session
 * DELETE /api/courses/:courseId/livesessions/:liveSessionId
 */
export const deleteLiveSession = async (req, res) => {
  try {
    const { courseId, liveSessionId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    const liveSession = course.liveSessions.id(liveSessionId);
    if (!liveSession) {
      return res.status(404).json({
        success: false,
        message: "Live session not found"
      });
    }

    // Remove the session
    course.liveSessions.pull(liveSessionId);
    await course.save();

    console.log(`✅ Live session deleted: ${liveSession.title}`);

    return res.status(200).json({
      success: true,
      message: "Live session deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting live session:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Add recording URL to completed session
 * PATCH /api/courses/:courseId/livesessions/:liveSessionId/recording
 */
export const addSessionRecording = async (req, res) => {
  try {
    const { courseId, liveSessionId } = req.params;
    const { recordingUrl } = req.body;

    if (!recordingUrl) {
      return res.status(400).json({
        success: false,
        message: "Recording URL is required"
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    const liveSession = course.liveSessions.id(liveSessionId);
    if (!liveSession) {
      return res.status(404).json({
        success: false,
        message: "Live session not found"
      });
    }

    liveSession.recordingUrl = recordingUrl;
    liveSession.status = 'completed';
    await course.save();

    return res.status(200).json({
      success: true,
      message: "Recording added successfully",
      liveSession
    });

  } catch (error) {
    console.error("❌ Error adding recording:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get all upcoming live sessions across all courses
 * GET /api/livesessions/upcoming
 */
export const getAllUpcomingLiveSessions = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const now = new Date();

    const courses = await Course.find({
      status: 'published',
      'liveSessions.scheduledAt': { $gte: now }
    }).select('title liveSessions color icon');

    // Flatten and filter upcoming sessions
    const upcomingSessions = [];
    
    courses.forEach(course => {
      course.liveSessions.forEach(session => {
        if (new Date(session.scheduledAt) >= now && session.status !== 'cancelled') {
          upcomingSessions.push({
            ...session.toObject(),
            courseId: course._id,
            courseTitle: course.title,
            courseColor: course.color,
            courseIcon: course.icon
          });
        }
      });
    });

    // Sort by scheduled date and limit
    upcomingSessions.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    const limitedSessions = upcomingSessions.slice(0, parseInt(limit));

    return res.status(200).json({
      success: true,
      message: "Upcoming live sessions fetched",
      liveSessions: limitedSessions,
      count: limitedSessions.length
    });

  } catch (error) {
    console.error("❌ Error fetching upcoming sessions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
