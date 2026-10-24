import { Course } from '../models/course.models.js';
import { evaluateCourseEnrollmentAccess } from '../services/entitlement.service.js';

export const requireCourseAccess = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.params.id;
    const course = await Course.findById(courseId).select('title includedInPlans');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const decision = await evaluateCourseEnrollmentAccess({
      userId: req.user._id,
      course,
    });

    if (!decision.allowed) {
      return res.status(decision.statusCode || 403).json({
        success: false,
        message: decision.message || 'You do not have access to this course',
        reason: decision.reason,
        upgradeRequired: Boolean(decision.upgradeRequired),
        needsCourseSelection: Boolean(decision.needsCourseSelection),
        remainingCredits: decision.remainingCredits,
        membershipId: decision.membershipId,
      });
    }

    req.course = course;
    return next();
  } catch (error) {
    console.error('Course Access Middleware Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify course access',
    });
  }
};

export default requireCourseAccess;
