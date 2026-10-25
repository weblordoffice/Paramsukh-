import mongoose from 'mongoose';
import { Course } from '../../models/course.models.js';
import { CourseAssessment } from '../../models/courseAssessment.models.js';
import { AssessmentAttempt } from '../../models/assessmentAttempt.models.js';
import { VivaApplication } from '../../models/vivaApplication.models.js';
import { Certificate } from '../../models/certificate.models.js';
import Notification from '../../models/notification.models.js';
import { sendPushToUser } from '../../services/pushService.js';
import {
  getAssessmentMetaForAdmin,
  gradeAssessmentAttemptManually,
} from '../../services/courseAssessment.service.js';
import { transitionVivaApplication } from '../../services/viva.service.js';
import {
  issueAssessmentCertificate,
  revokeCertificate,
} from '../../services/certificate.service.js';

const sendError = (res, error, fallbackMessage) => {
  const status = error.status || 500;
  const payload = {
    success: false,
    message: status === 500 ? fallbackMessage : error.message,
  };
  if (error.code) payload.code = error.code;
  if (error.missingQuestionIds) payload.missingQuestionIds = error.missingQuestionIds;
  if (status === 500) payload.error = error.message;

  return res.status(status).json(payload);
};

const parsePagination = (query) => {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  return { page, limit, skip: (page - 1) * limit };
};

const normalizeQuestion = (question, index) => {
  const prompt = String(question?.prompt || '').trim();
  const type = ['mcq', 'short_answer', 'descriptive'].includes(question?.type)
    ? question.type
    : 'mcq';
  const points = question?.points === undefined ? 1 : Number(question.points);
  const order = question?.order === undefined ? index : Number(question.order);
  const gradingMode = ['exact', 'contains', 'manual'].includes(question?.gradingMode)
    ? question.gradingMode
    : 'exact';

  if (!prompt) return { error: `Question ${index + 1}: prompt is required` };
  if (!Number.isFinite(points) || points < 0) return { error: `Question ${index + 1}: invalid points` };
  if (!Number.isFinite(order) || order < 0) return { error: `Question ${index + 1}: invalid order` };

  const normalized = {
    ...(question?._id && mongoose.Types.ObjectId.isValid(String(question._id))
      ? { _id: question._id }
      : {}),
    prompt,
    type,
    points,
    order,
    gradingMode,
    isEnabled: question?.isEnabled !== false,
    explanation: String(question?.explanation || '').trim(),
    options: [],
    correctOptionKey: null,
    acceptedAnswers: [],
  };

  if (type === 'mcq') {
    const options = (Array.isArray(question.options) ? question.options : [])
      .map((option) => ({
        key: String(option?.key || '').trim(),
        text: String(option?.text || '').trim(),
      }))
      .filter((option) => option.key && option.text);

    if (options.length < 2) {
      return { error: `Question ${index + 1}: at least two options are required` };
    }
    if (new Set(options.map((option) => option.key.toLowerCase())).size !== options.length) {
      return { error: `Question ${index + 1}: option keys must be unique` };
    }

    const correctOptionKey = String(question.correctOptionKey || '').trim();
    if (!options.some((option) => option.key.toLowerCase() === correctOptionKey.toLowerCase())) {
      return { error: `Question ${index + 1}: correctOptionKey must match an option` };
    }

    normalized.options = options;
    normalized.correctOptionKey = correctOptionKey;
  }

  if (type === 'short_answer') {
    const acceptedAnswers = Array.isArray(question.acceptedAnswers)
      ? question.acceptedAnswers.map((answer) => String(answer || '').trim()).filter(Boolean)
      : [];
    if (gradingMode !== 'manual' && acceptedAnswers.length === 0) {
      return { error: `Question ${index + 1}: acceptedAnswers are required for auto-grading` };
    }
    normalized.acceptedAnswers = acceptedAnswers;
  }

  return { value: normalized };
};

const buildAssessmentPayload = (body) => {
  const title = String(body?.title || 'Course Assessment').trim();
  const instructions = String(body?.instructions || '').trim();
  const questions = Array.isArray(body?.questions) ? body.questions : [];

  if (!questions.length) {
    return { error: 'At least one assessment question is required' };
  }

  const normalizedQuestions = [];
  for (let index = 0; index < questions.length; index += 1) {
    const normalized = normalizeQuestion(questions[index], index);
    if (normalized.error) return normalized;
    normalizedQuestions.push(normalized.value);
  }

  const passingRuleType = ['correct_count', 'percentage'].includes(body?.passingRule?.type)
    ? body.passingRule.type
    : 'correct_count';
  const passingRuleValue = Number(body?.passingRule?.value ?? 5);
  if (!Number.isFinite(passingRuleValue) || passingRuleValue < 0) {
    return { error: 'Invalid passing rule value' };
  }
  if (passingRuleType === 'percentage' && passingRuleValue > 100) {
    return { error: 'Percentage passing rule cannot exceed 100' };
  }
  if (passingRuleType === 'correct_count') {
    const activeQuestionCount = normalizedQuestions.filter((question) => question.isEnabled !== false).length;
    if (passingRuleValue > activeQuestionCount) {
      return {
        error: `Correct-answer passing rule cannot exceed the number of enabled questions (${activeQuestionCount}).`,
      };
    }
  }

  const maxAttempts = Number(body?.maxAttempts ?? 3);
  const retakeCooldownHours = Number(body?.retakeCooldownHours ?? 0);
  const timeLimitMinutes = Number(body?.timeLimitMinutes ?? 0);

  if (!Number.isFinite(maxAttempts) || maxAttempts < 1) return { error: 'maxAttempts must be at least 1' };
  if (!Number.isFinite(retakeCooldownHours) || retakeCooldownHours < 0) return { error: 'Invalid retakeCooldownHours' };
  if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes < 0) return { error: 'Invalid timeLimitMinutes' };

  return {
    value: {
      title: title || 'Course Assessment',
      instructions,
      questions: normalizedQuestions,
      passingRule: { type: passingRuleType, value: passingRuleValue },
      maxAttempts,
      retakeCooldownHours,
      timeLimitMinutes,
      shuffleQuestions: body?.shuffleQuestions === true,
      ...(body?.isEnabled !== undefined ? { isEnabled: body.isEnabled === true } : {}),
      vivaRequired: body?.vivaRequired !== false,
    },
  };
};

export const getAdminCourseAssessment = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId).select('title').lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const assessment = await CourseAssessment.findOne({ course: req.params.courseId }).lean();
    return res.status(200).json({
      success: true,
      course,
      assessment: assessment ? getAssessmentMetaForAdmin(assessment) : null,
    });
  } catch (error) {
    console.error('Get Admin Course Assessment Error:', error);
    return sendError(res, error, 'Failed to load course assessment');
  }
};

export const upsertAdminCourseAssessment = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId).select('_id').lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const payload = buildAssessmentPayload(req.body || {});
    if (payload.error) {
      return res.status(400).json({ success: false, message: payload.error });
    }

    const adminId = req.admin?._id || null;
    let assessment = await CourseAssessment.findOne({ course: req.params.courseId });

    if (!assessment) {
      assessment = await CourseAssessment.create({
        course: req.params.courseId,
        ...payload.value,
        createdBy: adminId,
        updatedBy: adminId,
      });
    } else {
      Object.assign(assessment, payload.value, { updatedBy: adminId });
      await assessment.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Course assessment saved',
      assessment,
    });
  } catch (error) {
    console.error('Upsert Admin Course Assessment Error:', error);
    return sendError(res, error, 'Failed to save course assessment');
  }
};

export const listAdminAssessmentAttempts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const query = { course: req.params.courseId };
    if (req.query.status) query.status = req.query.status;

    const [attempts, total, statusCounts] = await Promise.all([
      AssessmentAttempt.find(query)
        .populate('user', 'displayName email phone')
        .populate('course', 'title')
        .sort({ submittedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AssessmentAttempt.countDocuments(query),
      AssessmentAttempt.aggregate([
        { $match: { course: new mongoose.Types.ObjectId(req.params.courseId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      attempts,
      statusCounts: Object.fromEntries(statusCounts.map((entry) => [entry._id, entry.count])),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List Admin Assessment Attempts Error:', error);
    return sendError(res, error, 'Failed to load assessment attempts');
  }
};

export const getAdminAssessmentAttempt = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findById(req.params.attemptId)
      .populate('user', 'displayName email phone')
      .populate('course', 'title')
      .populate('assessment')
      .lean();

    if (!attempt) return res.status(404).json({ success: false, message: 'Assessment attempt not found' });

    return res.status(200).json({ success: true, attempt });
  } catch (error) {
    console.error('Get Admin Assessment Attempt Error:', error);
    return sendError(res, error, 'Failed to load assessment attempt');
  }
};

export const gradeAdminAssessmentAttempt = async (req, res) => {
  try {
    const data = await gradeAssessmentAttemptManually({
      attemptId: req.params.attemptId,
      grades: req.body?.grades,
      adminId: req.admin?._id || null,
    });

    return res.status(200).json({
      success: true,
      message: 'Assessment attempt graded',
      ...data,
    });
  } catch (error) {
    console.error('Grade Admin Assessment Attempt Error:', error);
    return sendError(res, error, 'Failed to grade assessment attempt');
  }
};

export const listAdminVivaApplications = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.courseId) query.course = req.query.courseId;

    const [applications, total] = await Promise.all([
      VivaApplication.find(query)
        .populate('user', 'displayName email phone')
        .populate('course', 'title')
        .populate('assessmentAttempt', 'attemptNumber percentage passed submittedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VivaApplication.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      applications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List Admin Viva Applications Error:', error);
    return sendError(res, error, 'Failed to load viva applications');
  }
};

export const getAdminVivaApplication = async (req, res) => {
  try {
    const application = await VivaApplication.findById(req.params.vivaId)
      .populate('user', 'displayName email phone')
      .populate('course', 'title')
      .populate('assessmentAttempt')
      .populate('certificate')
      .lean();

    if (!application) return res.status(404).json({ success: false, message: 'Viva application not found' });

    return res.status(200).json({ success: true, application });
  } catch (error) {
    console.error('Get Admin Viva Application Error:', error);
    return sendError(res, error, 'Failed to load viva application');
  }
};

const notifyVivaUser = async (application, status, payload = {}) => {
  try {
    const course = await Course.findById(application.course).select('title').lean();
    const courseId = String(application.course);
    const courseTitle = course?.title || 'your course';
    const actionUrl = `/course-assessment?courseId=${courseId}&courseTitle=${encodeURIComponent(courseTitle)}`;
    const when = application.scheduledAt
      ? new Date(application.scheduledAt).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata',
        })
      : '';

    let type = 'viva_completed';
    let title = 'Viva update';
    let message = 'Your viva status has been updated.';

    if (status === 'scheduled') {
      type = 'viva_scheduled';
      title = 'Viva scheduled';
      message = `Your viva for ${courseTitle} is scheduled for ${when}.`;
      if (application.meetingLink) {
        message += ` Join: ${application.meetingLink}`;
      }
    } else if (status === 'cancelled') {
      type = 'viva_cancelled';
      title = 'Viva cancelled';
      message = `Your viva for ${courseTitle} was cancelled.`;
      if (payload.note || payload.notes) {
        message += ` ${String(payload.note || payload.notes).trim()}`;
      }
    } else if (status === 'no_show') {
      type = 'viva_no_show';
      title = 'Viva missed';
      message = `You missed your scheduled viva for ${courseTitle}. You can request another viva from the assessment page.`;
    } else if (status === 'completed') {
      type = 'viva_completed';
      title = 'Viva completed';
      message = `Your viva for ${courseTitle} is completed. The result will be shared soon.`;
    } else if (status === 'passed') {
      type = 'viva_result';
      title = 'Viva passed';
      message = `You passed the viva for ${courseTitle}. Your assessment certificate can now be issued.`;
    } else if (status === 'failed') {
      type = 'viva_result';
      title = 'Viva result';
      message = `You did not pass the viva for ${courseTitle}. You can request another viva from the assessment page.`;
    } else {
      return;
    }

    await Notification.createNotification({
      user: application.user,
      type,
      title,
      message,
      relatedId: application._id,
      relatedType: 'course',
      actionUrl,
      icon: '🎥',
    });
    await sendPushToUser(application.user, {
      title,
      body: message,
      data: {
        type,
        actionUrl,
        relatedId: String(application._id),
      },
    });
  } catch (error) {
    console.error('Viva notification failed:', error?.message);
  }
};

export const updateAdminVivaStatus = async (req, res) => {
  try {
    const application = await transitionVivaApplication({
      vivaId: req.params.vivaId,
      nextStatus: req.body?.status,
      adminId: req.admin?._id || null,
      payload: req.body || {},
    });

    await notifyVivaUser(application, req.body?.status, req.body || {});

    return res.status(200).json({
      success: true,
      message: `Viva status updated to ${application.status}`,
      application,
    });
  } catch (error) {
    console.error('Update Admin Viva Status Error:', error);
    return sendError(res, error, 'Failed to update viva status');
  }
};

export const listAdminCertificates = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const query = {};
    if (req.query.type) query.type = req.query.type;
    if (req.query.status) query.status = req.query.status;
    if (req.query.userId) query.user = req.query.userId;

    const [certificates, total] = await Promise.all([
      Certificate.find(query)
        .populate('user', 'displayName email phone')
        .populate('course', 'title')
        .sort({ issuedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Certificate.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      certificates,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List Admin Certificates Error:', error);
    return sendError(res, error, 'Failed to load certificates');
  }
};

export const issueAdminAssessmentCertificate = async (req, res) => {
  try {
    const { userId, courseId, vivaApplicationId } = req.body || {};
    if (!userId || !courseId || !vivaApplicationId) {
      return res.status(400).json({
        success: false,
        message: 'userId, courseId, and vivaApplicationId are required',
      });
    }

    const certificate = await issueAssessmentCertificate({
      userId,
      courseId,
      vivaApplicationId,
      adminId: req.admin?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Assessment certificate issued',
      certificate,
    });
  } catch (error) {
    console.error('Issue Admin Assessment Certificate Error:', error);
    return sendError(res, error, 'Failed to issue assessment certificate');
  }
};

export const revokeAdminCertificate = async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: 'A revocation reason is required' });
    }

    const certificate = await revokeCertificate(req.params.certificateId, {
      adminId: req.admin?._id || null,
      reason,
    });

    return res.status(200).json({
      success: true,
      message: 'Certificate revoked',
      certificate,
    });
  } catch (error) {
    console.error('Revoke Admin Certificate Error:', error);
    return sendError(res, error, 'Failed to revoke certificate');
  }
};
