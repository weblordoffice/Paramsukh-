import { CourseAssessment } from '../models/courseAssessment.models.js';
import { AssessmentAttempt } from '../models/assessmentAttempt.models.js';
import {
  getCourseCertificationEligibility,
  recalculateAssessmentUnlock,
} from './certificationEligibility.service.js';
import {
  gradeAssessmentAnswers,
  recalculateAttemptResult,
  sanitizeAssessmentForStudent,
} from './assessmentGrading.service.js';

const createError = (message, status = 400, details = {}) => {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, details);
  return error;
};

const toAttemptSummary = (attempt) => {
  if (!attempt) return null;
  return {
    _id: attempt._id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    gradedAt: attempt.gradedAt,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.totalQuestions,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percentage: attempt.percentage,
    passed: attempt.passed,
  };
};

const toAttemptWithAnswers = (attempt) => ({
  ...toAttemptSummary(attempt),
  answers: (attempt.answers || []).map((answer) => ({
    questionId: answer.questionId,
    questionType: answer.questionType,
    answer: answer.answer,
    awardedPoints: answer.awardedPoints,
    isCorrect: answer.isCorrect,
    gradingStatus: answer.gradingStatus,
    feedback: answer.feedback,
  })),
});

const getAssessmentMeta = (assessment) => ({
  _id: assessment._id,
  course: assessment.course,
  title: assessment.title,
  instructions: assessment.instructions,
  questionCount: (assessment.questions || []).filter((question) => question.isEnabled !== false).length,
  passingRule: assessment.passingRule,
  maxAttempts: assessment.maxAttempts,
  retakeCooldownHours: assessment.retakeCooldownHours,
  timeLimitMinutes: assessment.timeLimitMinutes,
  vivaRequired: assessment.vivaRequired,
  isEnabled: assessment.isEnabled,
});

const expireStaleAttempts = async ({ userId, assessmentId }) => {
  await AssessmentAttempt.updateMany(
    {
      user: userId,
      assessment: assessmentId,
      status: 'in_progress',
      expiresAt: { $ne: null, $lt: new Date() },
    },
    { $set: { status: 'expired' } }
  );
};

const getAttemptUsage = async ({ userId, courseId, assessment }) => {
  await expireStaleAttempts({ userId, assessmentId: assessment._id });

  const attempts = await AssessmentAttempt.find({
    user: userId,
    course: courseId,
    assessment: assessment._id,
  })
    .sort({ attemptNumber: -1 })
    .lean();

  const activeAttempt = attempts.find((attempt) => attempt.status === 'in_progress') || null;
  const usedAttempts = attempts.filter((attempt) => attempt.status !== 'in_progress');
  const latestSubmitted = usedAttempts
    .filter((attempt) => attempt.submittedAt)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] || null;

  const cooldownHours = Number(assessment.retakeCooldownHours || 0);
  const nextAvailableAt = cooldownHours > 0 && latestSubmitted?.submittedAt
    ? new Date(new Date(latestSubmitted.submittedAt).getTime() + cooldownHours * 60 * 60 * 1000)
    : null;

  return {
    attempts,
    activeAttempt,
    usedCount: usedAttempts.length,
    remaining: Math.max(0, Number(assessment.maxAttempts || 0) - usedAttempts.length),
    latestAttempt: attempts[0] || null,
    latestSubmitted,
    nextAvailableAt,
  };
};

const ensureAssessmentVisible = async (courseId) => {
  const assessment = await CourseAssessment.findOne({ course: courseId }).lean();
  if (!assessment) {
    throw createError('Assessment is not configured for this course', 404, {
      code: 'ASSESSMENT_NOT_CONFIGURED',
    });
  }
  if (!assessment.isEnabled) {
    throw createError('Assessment is not available for this course', 403, {
      code: 'ASSESSMENT_DISABLED',
    });
  }
  if (!(assessment.questions || []).some((question) => question.isEnabled !== false)) {
    throw createError('Assessment has no active questions', 409, {
      code: 'ASSESSMENT_EMPTY',
    });
  }
  return assessment;
};

const ensureUnlocked = async (userId, courseId) => {
  const snapshot = await recalculateAssessmentUnlock(userId, courseId);
  if (!snapshot.enrolled) {
    throw createError('Enroll in this course before taking the assessment', 403, {
      code: 'NOT_ENROLLED',
    });
  }
  if (!snapshot.assessmentUnlocked) {
    throw createError('Complete all required course content and quizzes to unlock the assessment', 403, {
      code: 'ASSESSMENT_LOCKED',
      remaining: snapshot.remaining,
    });
  }
  return snapshot;
};

export const getAssessmentOverview = async (userId, courseId) => {
  const eligibility = await getCourseCertificationEligibility(userId, courseId);
  const assessment = await CourseAssessment.findOne({ course: courseId }).lean();

  if (!assessment) {
    return {
      assessment: null,
      eligibility: {
        enrolled: eligibility.enrolled,
        learningComplete: eligibility.learningComplete,
        requiredAssignmentsComplete: eligibility.requiredAssignmentsComplete,
        assessmentUnlocked: false,
        participationEligible: eligibility.participationEligible,
        remaining: eligibility.remaining,
      },
      attempts: {
        used: 0,
        remaining: 0,
        canStart: false,
        activeAttempt: null,
        latestAttempt: null,
        nextAvailableAt: null,
      },
      canStart: false,
      blockedReason: 'Assessment is not configured for this course.',
    };
  }

  const usage = await getAttemptUsage({ userId, courseId, assessment });
  const cooldownActive = usage.nextAvailableAt && usage.nextAvailableAt.getTime() > Date.now();
  const canStart = Boolean(
    assessment.isEnabled
    && eligibility.assessmentUnlocked
    && !usage.activeAttempt
    && usage.usedCount < assessment.maxAttempts
    && !cooldownActive
  );

  let blockedReason = null;
  if (!eligibility.enrolled) blockedReason = 'Enroll in this course first.';
  else if (!eligibility.assessmentUnlocked) blockedReason = 'Complete all required course content and quizzes to unlock the assessment.';
  else if (!assessment.isEnabled) blockedReason = 'Assessment is not available yet.';
  else if (usage.activeAttempt) blockedReason = 'Resume your active attempt.';
  else if (usage.usedCount >= assessment.maxAttempts) blockedReason = 'No attempts remaining.';
  else if (cooldownActive) blockedReason = 'Retake cooldown is still active.';

  return {
    assessment: getAssessmentMeta(assessment),
    eligibility: {
      enrolled: eligibility.enrolled,
      learningComplete: eligibility.learningComplete,
      requiredAssignmentsComplete: eligibility.requiredAssignmentsComplete,
      assessmentUnlocked: eligibility.assessmentUnlocked,
      participationEligible: eligibility.participationEligible,
      remaining: eligibility.remaining,
    },
    attempts: {
      used: usage.usedCount,
      remaining: usage.remaining,
      canStart,
      activeAttempt: toAttemptSummary(usage.activeAttempt),
      latestAttempt: toAttemptSummary(usage.latestAttempt),
      nextAvailableAt: usage.nextAvailableAt,
    },
    canStart,
    blockedReason,
  };
};

export const startAssessmentAttempt = async (userId, courseId) => {
  const assessment = await ensureAssessmentVisible(courseId);
  await ensureUnlocked(userId, courseId);

  const usage = await getAttemptUsage({ userId, courseId, assessment });
  if (usage.activeAttempt) {
    return {
      resumed: true,
      assessment: sanitizeAssessmentForStudent(assessment),
      attempt: toAttemptWithAnswers(usage.activeAttempt),
      usage: {
        used: usage.usedCount,
        remaining: usage.remaining,
      },
    };
  }

  if (usage.usedCount >= assessment.maxAttempts) {
    throw createError('No assessment attempts remaining', 409, {
      code: 'MAX_ATTEMPTS_REACHED',
      maxAttempts: assessment.maxAttempts,
    });
  }

  if (usage.nextAvailableAt && usage.nextAvailableAt.getTime() > Date.now()) {
    throw createError('Assessment retake cooldown is still active', 429, {
      code: 'RETAKE_COOLDOWN',
      nextAvailableAt: usage.nextAvailableAt,
    });
  }

  const startedAt = new Date();
  const expiresAt = Number(assessment.timeLimitMinutes) > 0
    ? new Date(startedAt.getTime() + Number(assessment.timeLimitMinutes) * 60 * 1000)
    : null;

  const attemptNumber = (usage.latestAttempt?.attemptNumber || 0) + 1;

  try {
    const attempt = await AssessmentAttempt.create({
      user: userId,
      course: courseId,
      assessment: assessment._id,
      attemptNumber,
      status: 'in_progress',
      startedAt,
      expiresAt,
    });

    return {
      resumed: false,
      assessment: sanitizeAssessmentForStudent(assessment),
      attempt: toAttemptWithAnswers(attempt),
      usage: {
        used: usage.usedCount,
        remaining: usage.remaining,
      },
    };
  } catch (error) {
    if (error?.code === 11000) {
      const activeAttempt = await AssessmentAttempt.findOne({
        user: userId,
        course: courseId,
        assessment: assessment._id,
        status: 'in_progress',
      });
      if (activeAttempt) {
        return {
          resumed: true,
          assessment: sanitizeAssessmentForStudent(assessment),
          attempt: toAttemptWithAnswers(activeAttempt),
          usage: {
            used: usage.usedCount,
            remaining: usage.remaining,
          },
        };
      }
    }
    throw error;
  }
};

export const submitAssessmentAttempt = async ({
  userId,
  courseId,
  attemptId,
  answers,
}) => {
  const [assessment, attempt] = await Promise.all([
    CourseAssessment.findOne({ course: courseId }),
    AssessmentAttempt.findOne({
      _id: attemptId,
      user: userId,
      course: courseId,
    }),
  ]);

  if (!assessment) {
    throw createError('Assessment is not configured for this course', 404);
  }
  if (!attempt) {
    throw createError('Assessment attempt not found', 404);
  }
  if (attempt.status !== 'in_progress') {
    throw createError('This assessment attempt has already been submitted', 409, {
      code: 'ATTEMPT_ALREADY_SUBMITTED',
    });
  }
  if (attempt.expiresAt && attempt.expiresAt.getTime() < Date.now()) {
    attempt.status = 'expired';
    await attempt.save();
    throw createError('This assessment attempt has expired', 409, {
      code: 'ATTEMPT_EXPIRED',
    });
  }

  const result = gradeAssessmentAnswers(assessment, answers || {});

  attempt.answers = result.answers;
  attempt.correctCount = result.correctCount;
  attempt.totalQuestions = result.totalQuestions;
  attempt.score = result.score;
  attempt.maxScore = result.maxScore;
  attempt.percentage = result.percentage;
  attempt.passed = result.passed;
  attempt.status = result.status;
  attempt.submittedAt = new Date();
  attempt.gradedAt = result.status === 'graded' ? new Date() : null;
  await attempt.save();

  return {
    attempt: toAttemptWithAnswers(attempt),
    result: {
      status: result.status,
      correctCount: result.correctCount,
      totalQuestions: result.totalQuestions,
      score: result.score,
      maxScore: result.maxScore,
      percentage: result.percentage,
      passed: result.passed,
      hasManualPending: result.hasManualPending,
    },
  };
};

export const getUserAssessmentAttempts = async (userId, courseId) => {
  const attempts = await AssessmentAttempt.find({ user: userId, course: courseId })
    .sort({ attemptNumber: -1 })
    .lean();

  return attempts.map(toAttemptWithAnswers);
};

export const gradeAssessmentAttemptManually = async ({
  attemptId,
  grades,
  adminId,
}) => {
  const attempt = await AssessmentAttempt.findById(attemptId);
  if (!attempt) {
    throw createError('Assessment attempt not found', 404);
  }
  if (attempt.status !== 'pending_manual') {
    throw createError('Only attempts with pending manual answers can be graded', 409);
  }

  const assessment = await CourseAssessment.findById(attempt.assessment);
  if (!assessment) {
    throw createError('Assessment not found', 404);
  }

  const questionMap = new Map(
    (assessment.questions || []).map((question) => [String(question._id), question])
  );

  const gradeList = Array.isArray(grades)
    ? grades
    : Object.entries(grades || {}).map(([questionId, value]) => ({
      questionId,
      ...(typeof value === 'object' ? value : { awardedPoints: value }),
    }));

  const gradeMap = new Map(
    gradeList
      .filter((grade) => grade?.questionId)
      .map((grade) => [String(grade.questionId), grade])
  );

  const pendingAnswers = attempt.answers.filter(
    (answer) => answer.gradingStatus === 'manual_pending'
  );
  const missingGrades = pendingAnswers
    .filter((answer) => !gradeMap.has(String(answer.questionId)))
    .map((answer) => String(answer.questionId));

  if (missingGrades.length) {
    throw createError('Provide grades for every pending manual answer', 400, {
      missingQuestionIds: missingGrades,
    });
  }

  attempt.answers.forEach((answer) => {
    if (answer.gradingStatus !== 'manual_pending') return;

    const grade = gradeMap.get(String(answer.questionId));
    const question = questionMap.get(String(answer.questionId));
    if (!grade || !question) return;

    const awardedPoints = Number(grade.awardedPoints || 0);
    if (!Number.isFinite(awardedPoints) || awardedPoints < 0 || awardedPoints > Number(question.points || 0)) {
      throw createError(`Invalid awarded points for question ${answer.questionId}`, 400);
    }

    answer.awardedPoints = awardedPoints;
    answer.isCorrect = grade.isCorrect !== undefined
      ? grade.isCorrect === true
      : awardedPoints >= Number(question.points || 0);
    answer.gradingStatus = 'manual_graded';
    answer.feedback = String(grade.feedback || '').trim();
    answer.gradedBy = adminId || null;
    answer.gradedAt = new Date();
  });

  const result = recalculateAttemptResult(assessment, attempt.answers, {
    maxScore: attempt.maxScore,
    totalQuestions: attempt.totalQuestions,
  });

  attempt.correctCount = result.correctCount;
  attempt.score = result.score;
  attempt.percentage = result.percentage;
  attempt.passed = result.passed;
  attempt.status = result.status;
  attempt.gradedAt = result.hasManualPending ? null : new Date();
  attempt.gradedBy = result.hasManualPending ? null : (adminId || null);
  await attempt.save();

  return {
    attempt: toAttemptWithAnswers(attempt),
    result: {
      status: result.status,
      correctCount: result.correctCount,
      totalQuestions: result.totalQuestions,
      score: result.score,
      maxScore: result.maxScore,
      percentage: result.percentage,
      passed: result.passed,
      hasManualPending: result.hasManualPending,
    },
  };
};

export const getAssessmentMetaForAdmin = (assessment) => {
  if (!assessment) return null;
  return {
    ...assessment,
    questionCount: (assessment.questions || []).filter((question) => question.isEnabled !== false).length,
  };
};

export { getAttemptUsage, toAttemptSummary, toAttemptWithAnswers };
