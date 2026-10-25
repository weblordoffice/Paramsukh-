import mongoose from 'mongoose';
import { Course } from '../models/course.models.js';
import { getAdminFromRequest, isValidAdminApiKey } from './adminAuth.js';
import { evaluateCourseEnrollmentAccess } from '../services/entitlement.service.js';

export const requireCourseAccess = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.params.id;
    if (!mongoose.Types.ObjectId.isValid(String(courseId))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course id',
      });
    }

    const course = await Course.findById(courseId).select('title includedInPlans status');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const isAdmin = isValidAdminApiKey(req) || Boolean(await getAdminFromRequest(req));
    if (!isAdmin && course.status !== 'published') {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    if (isAdmin) {
      req.course = course;
      req.courseAccess = { allowed: true, reason: 'admin' };
      return next();
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
    req.courseAccess = decision;
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
