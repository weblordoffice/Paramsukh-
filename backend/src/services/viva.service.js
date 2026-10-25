import { VivaApplication } from '../models/vivaApplication.models.js';
import { AssessmentAttempt } from '../models/assessmentAttempt.models.js';

const ACTIVE_VIVA_STATUSES = ['applied', 'under_review', 'scheduled', 'completed', 'passed'];

const ALLOWED_TRANSITIONS = {
  applied: ['under_review', 'cancelled'],
  under_review: ['scheduled', 'cancelled'],
  scheduled: ['completed', 'cancelled', 'no_show'],
  completed: ['passed', 'failed'],
  passed: [],
  failed: [],
  cancelled: ['applied'],
  no_show: ['scheduled', 'applied', 'cancelled'],
};

const buildHistoryEntry = ({ from, to, actorId, actorType = 'admin', note = '' }) => ({
  from,
  to,
  actorType,
  actor: actorId || null,
  note,
  at: new Date(),
});

export const getApplicableAssessmentAttempt = async (userId, courseId) =>
  AssessmentAttempt.findOne({
    user: userId,
    course: courseId,
    passed: true,
    status: 'graded',
  })
    .sort({ submittedAt: -1, createdAt: -1 })
    .lean();

export const canApplyForViva = async (userId, courseId) => {
  const attempt = await getApplicableAssessmentAttempt(userId, courseId);
  if (!attempt) {
    return {
      canApply: false,
      reason: 'Pass the course assessment before applying for the viva.',
      attempt: null,
      application: null,
    };
  }

  const existing = await VivaApplication.findOne({
    user: userId,
    course: courseId,
    assessmentAttempt: attempt._id,
  }).lean();

  if (existing && ACTIVE_VIVA_STATUSES.includes(existing.status)) {
    return {
      canApply: false,
      reason: existing.status === 'passed'
        ? 'The viva has already been passed.'
        : 'A viva application already exists for this assessment attempt.',
      attempt,
      application: existing,
    };
  }

  if (existing && existing.status === 'failed') {
    return {
      canApply: true,
      reason: null,
      attempt,
      application: existing,
    };
  }

  return {
    canApply: true,
    reason: null,
    attempt,
    application: existing || null,
  };
};

export const applyForViva = async (userId, courseId, note = '') => {
  const eligibility = await canApplyForViva(userId, courseId);
  if (!eligibility.canApply) {
    const error = new Error(eligibility.reason);
    error.status = eligibility.attempt ? 409 : 400;
    throw error;
  }

  try {
    if (['cancelled', 'no_show', 'failed'].includes(eligibility.application?.status)) {
      const revived = await VivaApplication.findByIdAndUpdate(
        eligibility.application._id,
        {
          $set: {
            status: 'applied',
            appliedAt: new Date(),
            notes: String(note || '').trim(),
            scheduledAt: null,
            completedAt: null,
            noShowAt: null,
            meetingPlatform: '',
            meetingLink: '',
            examiner: null,
            certificate: null,
            reminder24SentAt: null,
            reminder1SentAt: null,
            'result.status': null,
            'result.remarks': '',
            'result.feedback': '',
            'result.recordedBy': null,
            'result.recordedAt': null,
          },
          $push: {
            statusHistory: buildHistoryEntry({
              from: eligibility.application.status,
              to: 'applied',
              actorId: userId,
              actorType: 'user',
              note: String(note || '').trim(),
            }),
          },
        },
        { new: true, runValidators: true }
      );
      if (revived) return revived;
    }

    return await VivaApplication.create({
      user: userId,
      course: courseId,
      assessmentAttempt: eligibility.attempt._id,
      status: 'applied',
      appliedAt: new Date(),
      notes: String(note || '').trim(),
      statusHistory: [buildHistoryEntry({
        from: null,
        to: 'applied',
        actorId: userId,
        actorType: 'user',
        note: String(note || '').trim(),
      })],
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await VivaApplication.findOne({
        user: userId,
        course: courseId,
        assessmentAttempt: eligibility.attempt._id,
      });
      const conflict = new Error('A viva application already exists for this assessment attempt.');
      conflict.status = 409;
      conflict.application = existing;
      throw conflict;
    }
    throw error;
  }
};

export const transitionVivaApplication = async ({
  vivaId,
  nextStatus,
  adminId,
  payload = {},
}) => {
  const viva = await VivaApplication.findById(vivaId);
  if (!viva) {
    const error = new Error('Viva application not found');
    error.status = 404;
    throw error;
  }

  const allowed = ALLOWED_TRANSITIONS[viva.status] || [];
  if (!allowed.includes(nextStatus)) {
    const error = new Error(`Invalid viva transition from ${viva.status} to ${nextStatus}`);
    error.status = 409;
    throw error;
  }

  if (nextStatus === 'scheduled') {
    const scheduledAt = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      const error = new Error('A valid scheduledAt date is required to schedule a viva');
      error.status = 400;
      throw error;
    }
    viva.scheduledAt = scheduledAt;
    viva.meetingPlatform = String(payload.meetingPlatform || '').trim();
    viva.meetingLink = String(payload.meetingLink || '').trim();
    viva.notes = String(payload.notes || viva.notes || '').trim();
    viva.examiner = payload.examiner || adminId || null;
    viva.noShowAt = null;
    viva.reminder24SentAt = null;
    viva.reminder1SentAt = null;
  }

  if (nextStatus === 'under_review') {
    viva.reviewedAt = new Date();
  }

  if (nextStatus === 'completed') {
    viva.completedAt = new Date();
    if (payload.notes !== undefined) {
      viva.notes = String(payload.notes || '').trim();
    }
  }

  if (nextStatus === 'no_show') {
    viva.noShowAt = new Date();
    if (payload.notes !== undefined || payload.note !== undefined) {
      viva.notes = String(payload.notes || payload.note || '').trim();
    }
  }

  if (nextStatus === 'passed' || nextStatus === 'failed') {
    const remarks = String(payload.remarks || '').trim();
    if (!remarks) {
      const error = new Error('A brief remark is required to record the viva result');
      error.status = 400;
      throw error;
    }

    viva.completedAt = viva.completedAt || new Date();
    viva.result = {
      status: nextStatus,
      remarks,
      feedback: String(payload.feedback || '').trim(),
      recordedBy: adminId || null,
      recordedAt: new Date(),
    };
  }

  const previousStatus = viva.status;
  viva.status = nextStatus;
  viva.statusHistory = viva.statusHistory || [];
  viva.statusHistory.push(buildHistoryEntry({
    from: previousStatus,
    to: nextStatus,
    actorId: adminId,
    actorType: 'admin',
    note: String(payload.note || payload.remarks || '').trim(),
  }));

  await viva.save();
  return viva;
};
