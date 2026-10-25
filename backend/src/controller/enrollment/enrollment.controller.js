import { Enrollment } from '../../models/enrollment.models.js';
import { Course } from '../../models/course.models.js';
import { evaluateCourseEnrollmentAccess } from '../../services/entitlement.service.js';
import { syncUserCommunityMembershipsByPlan } from '../../services/planUpgrade.service.js';
import { buildCourseViewerPayload } from '../../services/courseMedia.service.js';

/**
 * Get published course catalog with access reason flags
 * GET /api/enrollments/catalog
 */
export const getEnrollmentCatalog = async (req, res) => {
  try {
    const userId = req.user._id;

    const [courses, userEnrollments] = await Promise.all([
      Course.find({ status: 'published' })
        .select('title description thumbnailUrl bannerUrl color icon duration category tags status totalVideos totalPdfs enrollmentCount completionCount averageRating reviewCount includedInPlans createdAt')
        .sort({ createdAt: -1 }),
      Enrollment.find({ userId })
        .populate({ path: 'courseId', select: 'category' })
        .select('courseId')
        .lean(),
    ]);

    const enrolledCourseIdSet = new Set(
      userEnrollments
        .map((item) => item?.courseId?._id || item?.courseId)
        .filter(Boolean)
        .map((id) => String(id))
    );

    const enrolledCategories = userEnrollments
      .map((item) => item?.courseId?.category)
      .filter(Boolean)
      .map((category) => String(category).toLowerCase());

    const distinctCategoryCount = new Set(enrolledCategories).size;
    const totalEnrollments = userEnrollments.length;

    const catalog = await Promise.all(courses.map(async (course) => {
      const courseId = String(course._id);
      const courseCategory = String(course.category || '').toLowerCase();
      const alreadyEnrolled = enrolledCourseIdSet.has(courseId);
      const enrollmentsInSameCategory = enrolledCategories.filter((category) => category === courseCategory).length;
      const decision = await evaluateCourseEnrollmentAccess({
        userId,
        course,
        currentEnrollments: totalEnrollments,
        distinctEnrolledCategoryCount: distinctCategoryCount,
        isAlreadyUsingCourseCategory: enrolledCategories.includes(courseCategory),
        enrollmentsInSameCategory,
      });

      if (alreadyEnrolled) {
        return {
          ...course.toObject(),
          access: {
            canEnroll: false,
            canAccess: !!decision.allowed,
            reason: decision.allowed ? 'already_enrolled' : decision.reason,
            message: decision.allowed ? null : (decision.message || null),
          },
        };
      }

      return {
        ...course.toObject(),
        access: {
          canEnroll: !!decision.allowed,
          canAccess: !!decision.allowed,
          reason: decision.reason,
          message: decision.message || null,
        },
      };
    }));

    return res.status(200).json({
      success: true,
      message: 'Course catalog fetched successfully',
      courses: catalog,
    });
  } catch (error) {
    console.error('❌ Error fetching enrollment catalog:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Enroll user in a course
 * POST /api/enrollments/enroll
 */
export const enrollInCourse = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required"
      });
    }

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    if (course.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: "Course is not available for enrollment"
      });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({ userId, courseId });
    if (existingEnrollment) {
      return res.status(409).json({
        success: false,
        message: "You are already enrolled in this course"
      });
    }

    const userEnrollments = await Enrollment.find({ userId })
      .populate({ path: 'courseId', select: 'category' })
      .lean();

    const enrolledCategories = userEnrollments
      .map((item) => item?.courseId?.category)
      .filter(Boolean)
      .map((category) => String(category).toLowerCase());

    const targetCategory = String(course.category || '').toLowerCase();
    const categorySet = new Set(enrolledCategories);
    const enrollmentsInSameCategory = enrolledCategories.filter((category) => category === targetCategory).length;
    const currentEnrollments = userEnrollments.length;

    const enrollmentDecision = await evaluateCourseEnrollmentAccess({
      userId,
      course,
      currentEnrollments,
      distinctEnrolledCategoryCount: categorySet.size,
      isAlreadyUsingCourseCategory: categorySet.has(targetCategory),
      enrollmentsInSameCategory,
    });

    if (!enrollmentDecision.allowed) {
      return res.status(enrollmentDecision.statusCode || 403).json({
        success: false,
        message: enrollmentDecision.message,
        upgradeRequired: !!enrollmentDecision.upgradeRequired,
        restrictedPlan: !!enrollmentDecision.restrictedPlan,
        reason: enrollmentDecision.reason,
        currentEnrollments,
        limit: enrollmentDecision.limit,
      });
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      userId,
      courseId,
      currentVideoId: course.videos.length > 0 ? course.videos[0]._id : null
    });

    // Atomically update course enrollment count
    await Course.findByIdAndUpdate(courseId, { $inc: { enrollmentCount: 1 } });

    // Keep plan-category community groups aligned with the user's enrolled categories.
    try {
      await syncUserCommunityMembershipsByPlan({
        userId,
        planSlug: req.user?.subscriptionPlan,
        membershipActive: req.user?.subscriptionStatus === 'active',
      });
    } catch (syncError) {
      console.error(`⚠️ Community sync failed after enrollment for user ${userId}:`, syncError.message);
    }

    console.log(`✅ User ${userId} enrolled in course: ${course.title}`);

    return res.status(201).json({
      success: true,
      message: "Successfully enrolled in course",
      enrollment,
      course: {
        _id: course._id,
        title: course.title,
        totalVideos: course.totalVideos,
        totalPdfs: course.totalPdfs
      }
    });

  } catch (error) {
    console.error("❌ Error enrolling in course:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You are already enrolled in this course"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get user's enrollments
 * GET /api/enrollments/my-courses
 */
export const getMyEnrollments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { completed, inProgress } = req.query;

    const query = { userId };

    if (completed === 'true') {
      query.isCompleted = true;
    }
    if (inProgress === 'true') {
      query.isCompleted = false;
    }

    const enrollments = await Enrollment.find(query)
      .populate({
        path: 'courseId',
        select: 'title description icon color thumbnailUrl duration totalVideos totalPdfs category'
      })
      .sort({ lastAccessedAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Enrollments fetched successfully",
      enrollments,
      count: enrollments.length
    });

  } catch (error) {
    console.error("❌ Error fetching enrollments:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get enrollment details for a specific course
 * GET /api/enrollments/course/:courseId
 */
export const getEnrollmentByCourse = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({ userId, courseId })
      .populate({
        path: 'courseId',
        select: 'title description icon color thumbnailUrl bannerUrl duration totalVideos totalPdfs videos pdfs audioLessons liveSessions category includedInPlans status'
      });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found. Please enroll in this course first.",
        isEnrolled: false
      });
    }

    // Update last accessed
    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    const enrollmentPayload = enrollment.toObject();
    if (enrollmentPayload.courseId) {
      enrollmentPayload.courseId = await buildCourseViewerPayload(enrollmentPayload.courseId, {
        entitled: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Enrollment fetched successfully",
      enrollment: enrollmentPayload,
      isEnrolled: true
    });

  } catch (error) {
    console.error("❌ Error fetching enrollment:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update current video position (for resume functionality)
 * PATCH /api/enrollments/course/:courseId/position
 */
export const updateVideoPosition = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.params;
    const {
      videoId,
      videoIndex,
      positionSeconds,
      durationSeconds,
      isPaused = true
    } = req.body;

    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found"
      });
    }

    const course = await Course.findById(enrollment.courseId).select('videos').lean();
    const courseVideos = course?.videos || [];

    // The video must belong to this course. Prefer the posted id; fall back to
    // the index only when no id was sent.
    let resolvedIndex = videoId
      ? courseVideos.findIndex((video) => String(video._id) === String(videoId))
      : Number(videoIndex);
    if (!Number.isInteger(resolvedIndex) || resolvedIndex < 0 || resolvedIndex >= courseVideos.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video for this course'
      });
    }

    const resolvedVideo = courseVideos[resolvedIndex];
    if (videoId && String(videoId) !== String(resolvedVideo._id)) {
      return res.status(400).json({ success: false, message: 'Video does not belong to this course' });
    }

    const rawPosition = Math.max(0, Number(positionSeconds) || 0);
    const rawDuration = Math.max(0, Number(durationSeconds) || 0);
    const duration = Math.min(rawDuration, 12 * 60 * 60);
    const position = duration > 0 ? Math.min(rawPosition, duration) : rawPosition;

    enrollment.currentVideoId = resolvedVideo._id;
    enrollment.currentVideoIndex = resolvedIndex;
    enrollment.lastAccessedAt = new Date();
    enrollment.lastPlayedAt = new Date();
    enrollment.hasStartedLearning = true;
    enrollment.lastVideoPositionSeconds = position;
    enrollment.lastVideoDurationSeconds = duration;
    enrollment.videoProgress = [
      ...(enrollment.videoProgress || []).filter(
        (entry) => String(entry.videoId) !== String(resolvedVideo._id)
      ),
      {
        videoId: resolvedVideo._id,
        positionSeconds: position,
        durationSeconds: duration,
        updatedAt: new Date(),
      },
    ];

    if (isPaused !== false) {
      enrollment.lastPausedAt = new Date();
    }

    await enrollment.save();

    return res.status(200).json({
      success: true,
      message: "Position updated",
      currentVideoId: enrollment.currentVideoId,
      currentVideoIndex: enrollment.currentVideoIndex,
      lastVideoPositionSeconds: enrollment.lastVideoPositionSeconds,
      lastVideoDurationSeconds: enrollment.lastVideoDurationSeconds
    });

  } catch (error) {
    console.error("❌ Error updating video position:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update current audio position (for listen proof / resume)
 * PATCH /api/enrollments/course/:courseId/audio/:audioId/position
 */
export const updateAudioPosition = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId, audioId } = req.params;
    const { positionSeconds, durationSeconds } = req.body;

    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    const course = await Course.findById(courseId).select('audioLessons').lean();
    const lesson = (course?.audioLessons || []).find(
      (item) => String(item._id) === String(audioId)
    );
    if (!lesson) {
      return res.status(400).json({ success: false, message: 'Audio lesson does not belong to this course' });
    }

    const rawPosition = Math.max(0, Number(positionSeconds) || 0);
    const rawDuration = Math.max(0, Number(durationSeconds) || 0);
    const duration = Math.min(rawDuration, 12 * 60 * 60);
    const position = duration > 0 ? Math.min(rawPosition, duration) : rawPosition;

    enrollment.audioProgress = [
      ...(enrollment.audioProgress || []).filter(
        (entry) => String(entry.audioId) !== String(audioId)
      ),
      {
        audioId,
        positionSeconds: position,
        durationSeconds: duration,
        updatedAt: new Date(),
      },
    ];
    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    return res.status(200).json({
      success: true,
      message: 'Audio position updated',
      data: { audioId, positionSeconds: position, durationSeconds: duration },
    });
  } catch (error) {
    console.error('Error updating audio position:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * Unenroll from course
 * DELETE /api/enrollments/course/:courseId
 */
export const unenrollFromCourse = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOneAndDelete({ userId, courseId });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found"
      });
    }

    // Course counts are maintained by the Enrollment post-delete hook.

    if (enrollment.isCompleted) {
      const { Certificate } = await import('../../models/certificate.models.js');
      await Certificate.updateOne(
        { user: userId, course: courseId },
        { $set: { isRevoked: true, revokedAt: new Date() } }
      );
    }

    try {
      const { syncUserCommunityMembershipsByPlan } = await import('../../services/planUpgrade.service.js');
      await syncUserCommunityMembershipsByPlan({
        userId,
        planSlug: req.user?.subscriptionPlan,
        membershipActive: req.user?.subscriptionStatus === 'active',
      });
    } catch (syncError) {
      console.error('Community sync failed on unenrollment:', syncError.message);
    }

    console.log(`User ${userId} unenrolled from course: ${courseId}`);

    return res.status(200).json({
      success: true,
      message: "Successfully unenrolled from course"
    });

  } catch (error) {
    console.error("Error unenrolling from course:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Check enrollment status
 * GET /api/enrollments/check/:courseId
 */
export const checkEnrollmentStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({ userId, courseId });

    return res.status(200).json({
      success: true,
      isEnrolled: !!enrollment,
      enrollment: enrollment || null
    });

  } catch (error) {
    console.error("❌ Error checking enrollment status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get continue learning data.
 * Only returns courses where the user actually started a video and paused it,
 * and has not finished that video yet.
 * GET /api/enrollments/continue-learning
 */
export const getContinueLearning = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 5 } = req.query;

    const enrollments = await Enrollment.find({
      userId,
      isCompleted: false,
      hasStartedLearning: true,
      lastPausedAt: { $ne: null },
      lastVideoPositionSeconds: { $gt: 0 },
      $expr: {
        $or: [
          { $lte: ['$lastVideoDurationSeconds', 0] },
          {
            $lt: [
              '$lastVideoPositionSeconds',
              { $multiply: ['$lastVideoDurationSeconds', 0.99] }
            ]
          }
        ]
      }
    })
      .populate({
        path: 'courseId',
        select: 'title icon color thumbnailUrl totalVideos'
      })
      .sort({ lastPausedAt: -1, lastAccessedAt: -1 })
      .limit(Math.min(50, Math.max(1, parseInt(limit, 10) || 5)));

    return res.status(200).json({
      success: true,
      message: "Continue learning data fetched",
      courses: enrollments.map(e => ({
        enrollment: {
          _id: e._id,
          progress: e.progress,
          currentVideoIndex: e.currentVideoIndex,
          currentVideoId: e.currentVideoId,
          lastAccessedAt: e.lastAccessedAt,
          lastPausedAt: e.lastPausedAt,
          lastVideoPositionSeconds: e.lastVideoPositionSeconds,
          lastVideoDurationSeconds: e.lastVideoDurationSeconds
        },
        course: e.courseId
      }))
    });

  } catch (error) {
    console.error("❌ Error fetching continue learning:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};


