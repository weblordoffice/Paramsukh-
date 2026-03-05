import { Enrollment, COURSE_LIMITS } from '../../models/enrollment.models.js';
import { Course } from '../../models/course.models.js';
import { User } from '../../models/user.models.js';
import { AppConfig } from '../../models/appConfig.models.js';

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
      return res.status(400).json({
        success: false,
        message: "You are already enrolled in this course"
      });
    }



    // Check subscription and enrollment restrictions
    const user = await User.findById(userId);

    // Fetch dynamic configuration
    const membershipRules = await AppConfig.findOne({ key: 'membership_rules' }).lean();

    // Get restricted plans (auto-enroll only) with fallback
    const restrictedPlans = membershipRules?.value?.restrictedPlans || ['bronze', 'copper', 'silver'];

    if (restrictedPlans.includes(user.subscriptionPlan)) {
      // For restricted plans, verify if this course allows manual enrollment or is auto-enroll only
      // But typically these plans are strictly auto-enroll

      // However, if the course is explicitly marked as "Free" or accessible via some other logic, we might reconsider.
      // For now, adhere to the restriction rule but check if the user is ALREADY enrolled loop handled above.

      return res.status(403).json({
        success: false,
        message: `Your ${user.subscriptionPlan} membership includes pre-selected courses. Manual enrollment is not available. Please contact support if you need assistance.`,
        upgradeRequired: false,
        restrictedPlan: true
      });
    }

    // For other plans, check course limits
    // Get limits with fallback to hardcoded default
    const limitConfig = membershipRules?.value?.courseLimits || COURSE_LIMITS;
    const courseLimit = limitConfig[user.subscriptionPlan] !== undefined ? limitConfig[user.subscriptionPlan] : 0;

    // If limit is Infinity, allow enrollment
    // Note: JSON serialization of Infinity might be null or string, handle accordingly if stored in DB
    const isUnlimited = courseLimit === 'Infinity' || courseLimit === null || courseLimit === Infinity; // Handle stored variations

    if (isUnlimited) {
      // Allow enrollment for unlimited plans
    } else {
      const currentEnrollments = await Enrollment.countDocuments({ userId });

      if (currentEnrollments >= courseLimit) {
        return res.status(403).json({
          success: false,
          message: `Your ${user.subscriptionPlan} plan allows ${courseLimit} course(s). Please upgrade to enroll in more courses.`,
          currentEnrollments,
          limit: courseLimit,
          upgradeRequired: true
        });
      }
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      userId,
      courseId,
      currentVideoId: course.videos.length > 0 ? course.videos[0]._id : null
    });

    // Update course enrollment count
    course.enrollmentCount += 1;
    await course.save();

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
        select: 'title description icon color thumbnailUrl bannerUrl duration totalVideos totalPdfs videos pdfs liveSessions category'
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

    return res.status(200).json({
      success: true,
      message: "Enrollment fetched successfully",
      enrollment,
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
 * Mark video as complete
 * POST /api/enrollments/course/:courseId/video/:videoId/complete
 */
export const markVideoComplete = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId, videoId } = req.params;

    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found"
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    // Mark video complete
    enrollment.markVideoComplete(videoId);

    // Update progress
    enrollment.updateProgress(course.totalVideos, course.totalPdfs);

    // Update current video to next one
    const currentVideoIndex = course.videos.findIndex(v => v._id.toString() === videoId);
    if (currentVideoIndex < course.videos.length - 1) {
      enrollment.currentVideoIndex = currentVideoIndex + 1;
      enrollment.currentVideoId = course.videos[currentVideoIndex + 1]._id;
    }

    await enrollment.save();

    // Update course completion count if completed
    if (enrollment.isCompleted) {
      course.completionCount += 1;
      await course.save();
    }

    console.log(`✅ Video ${videoId} marked complete. Progress: ${enrollment.progress}%`);

    return res.status(200).json({
      success: true,
      message: "Video marked as complete",
      progress: enrollment.progress,
      isCompleted: enrollment.isCompleted,
      nextVideo: enrollment.currentVideoId,
      completedVideos: enrollment.completedVideos.length,
      totalVideos: course.totalVideos
    });

  } catch (error) {
    console.error("❌ Error marking video complete:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Mark PDF as complete
 * POST /api/enrollments/course/:courseId/pdf/:pdfId/complete
 */
export const markPdfComplete = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId, pdfId } = req.params;

    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found"
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    // Mark PDF complete
    enrollment.markPdfComplete(pdfId);

    // Update progress
    enrollment.updateProgress(course.totalVideos, course.totalPdfs);
    await enrollment.save();

    // Update course completion count if completed
    if (enrollment.isCompleted) {
      course.completionCount += 1;
      await course.save();
    }

    console.log(`✅ PDF ${pdfId} marked complete. Progress: ${enrollment.progress}%`);

    return res.status(200).json({
      success: true,
      message: "PDF marked as complete",
      progress: enrollment.progress,
      isCompleted: enrollment.isCompleted,
      completedPdfs: enrollment.completedPdfs.length,
      totalPdfs: course.totalPdfs
    });

  } catch (error) {
    console.error("❌ Error marking PDF complete:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get course progress
 * GET /api/enrollments/course/:courseId/progress
 */
export const getCourseProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found"
      });
    }

    const course = await Course.findById(courseId)
      .select('title totalVideos totalPdfs videos pdfs');

    return res.status(200).json({
      success: true,
      progress: {
        percentage: enrollment.progress,
        isCompleted: enrollment.isCompleted,
        completedAt: enrollment.completedAt,
        completedVideos: enrollment.completedVideos,
        completedPdfs: enrollment.completedPdfs,
        totalVideos: course.totalVideos,
        totalPdfs: course.totalPdfs,
        currentVideoId: enrollment.currentVideoId,
        currentVideoIndex: enrollment.currentVideoIndex,
        lastAccessedAt: enrollment.lastAccessedAt,
        enrolledAt: enrollment.enrolledAt
      }
    });

  } catch (error) {
    console.error("❌ Error fetching course progress:", error);
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
    const { videoId, videoIndex } = req.body;

    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found"
      });
    }

    enrollment.currentVideoId = videoId;
    enrollment.currentVideoIndex = videoIndex;
    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    return res.status(200).json({
      success: true,
      message: "Position updated",
      currentVideoId: enrollment.currentVideoId,
      currentVideoIndex: enrollment.currentVideoIndex
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

    // Update course enrollment count
    const course = await Course.findById(courseId);
    if (course) {
      course.enrollmentCount = Math.max(0, course.enrollmentCount - 1);
      await course.save();
    }

    console.log(`✅ User ${userId} unenrolled from course: ${courseId}`);

    return res.status(200).json({
      success: true,
      message: "Successfully unenrolled from course"
    });

  } catch (error) {
    console.error("❌ Error unenrolling from course:", error);
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
 * Get continue learning data (recently accessed courses)
 * GET /api/enrollments/continue-learning
 */
export const getContinueLearning = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 5 } = req.query;

    const enrollments = await Enrollment.find({
      userId,
      isCompleted: false
    })
      .populate({
        path: 'courseId',
        select: 'title icon color thumbnailUrl totalVideos'
      })
      .sort({ lastAccessedAt: -1 })
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      message: "Continue learning data fetched",
      courses: enrollments.map(e => ({
        enrollment: {
          _id: e._id,
          progress: e.progress,
          currentVideoIndex: e.currentVideoIndex,
          lastAccessedAt: e.lastAccessedAt
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

