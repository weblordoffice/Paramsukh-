import { VivaApplication } from '../../models/vivaApplication.models.js';
import {
  getAssessmentOverview,
  startAssessmentAttempt,
  submitAssessmentAttempt,
  getUserAssessmentAttempts,
} from '../../services/courseAssessment.service.js';
import {
  applyForViva,
  canApplyForViva,
} from '../../services/viva.service.js';

const sendError = (res, error, fallbackMessage) => {
  const status = error.status || 500;
  const payload = {
    success: false,
    message: status === 500 ? fallbackMessage : error.message,
  };
  if (error.code) payload.code = error.code;
  if (error.remaining) payload.remaining = error.remaining;
  if (error.nextAvailableAt) payload.nextAvailableAt = error.nextAvailableAt;
  if (error.maxAttempts) payload.maxAttempts = error.maxAttempts;
  if (error.missingQuestionIds) payload.missingQuestionIds = error.missingQuestionIds;
  if (status === 500) payload.error = error.message;

  return res.status(status).json(payload);
};

export const getCourseAssessmentOverview = async (req, res) => {
  try {
    const data = await getAssessmentOverview(req.user._id, req.params.courseId);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('Get Course Assessment Overview Error:', error);
    return sendError(res, error, 'Failed to load assessment');
  }
};

export const startCourseAssessment = async (req, res) => {
  try {
    const data = await startAssessmentAttempt(req.user._id, req.params.courseId);
    return res.status(200).json({
      success: true,
      message: data.resumed ? 'Resuming existing assessment attempt' : 'Assessment started',
      ...data,
    });
  } catch (error) {
    console.error('Start Course Assessment Error:', error);
    return sendError(res, error, 'Failed to start assessment');
  }
};

export const submitCourseAssessment = async (req, res) => {
  try {
    const { attemptId, answers } = req.body || {};
    if (!attemptId) {
      return res.status(400).json({ success: false, message: 'attemptId is required' });
    }

    const data = await submitAssessmentAttempt({
      userId: req.user._id,
      courseId: req.params.courseId,
      attemptId,
      answers,
    });

    return res.status(200).json({
      success: true,
      message: data.result.hasManualPending
        ? 'Assessment submitted and is awaiting manual grading'
        : 'Assessment submitted',
      ...data,
    });
  } catch (error) {
    console.error('Submit Course Assessment Error:', error);
    return sendError(res, error, 'Failed to submit assessment');
  }
};

export const getCourseAssessmentAttempts = async (req, res) => {
  try {
    const attempts = await getUserAssessmentAttempts(req.user._id, req.params.courseId);
    return res.status(200).json({ success: true, attempts });
  } catch (error) {
    console.error('Get Course Assessment Attempts Error:', error);
    return sendError(res, error, 'Failed to load assessment attempts');
  }
};

export const getCourseViva = async (req, res) => {
  try {
    const { courseId } = req.params;
    const eligibility = await canApplyForViva(req.user._id, courseId);
    const latest = await VivaApplication.findOne({
      user: req.user._id,
      course: courseId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      canApply: eligibility.canApply,
      reason: eligibility.reason,
      assessmentAttemptId: eligibility.attempt?._id || null,
      application: latest || null,
    });
  } catch (error) {
    console.error('Get Course Viva Error:', error);
    return sendError(res, error, 'Failed to load viva status');
  }
};

export const applyCourseViva = async (req, res) => {
  try {
    const application = await applyForViva(
      req.user._id,
      req.params.courseId,
      req.body?.note || ''
    );

    return res.status(201).json({
      success: true,
      message: 'Viva application submitted',
      application,
    });
  } catch (error) {
    console.error('Apply Course Viva Error:', error);
    return sendError(res, error, 'Failed to apply for viva');
  }
};

export const getUserVivaApplications = async (req, res) => {
  try {
    const applications = await VivaApplication.find({ user: req.user._id })
      .populate('course', 'title thumbnailUrl')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, applications });
  } catch (error) {
    console.error('Get User Viva Applications Error:', error);
    return sendError(res, error, 'Failed to load viva applications');
  }
};
