const normalizeText = (value) => String(value ?? '').trim().toLowerCase();

const normalizeAnswerList = (values) =>
  (Array.isArray(values) ? values : [])
    .map(normalizeText)
    .filter(Boolean);

const getEnabledQuestions = (assessment) =>
  (assessment?.questions || [])
    .filter((question) => question.isEnabled !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

export const sanitizeQuestionForStudent = (question) => ({
  _id: question._id,
  prompt: question.prompt,
  type: question.type,
  options: (question.options || []).map((option) => ({
    key: option.key,
    text: option.text,
  })),
  points: question.points,
  order: question.order,
});

export const sanitizeAssessmentForStudent = (assessment) => {
  if (!assessment) return null;

  return {
    _id: assessment._id,
    course: assessment.course,
    title: assessment.title,
    instructions: assessment.instructions,
    questions: getEnabledQuestions(assessment).map(sanitizeQuestionForStudent),
    passingRule: {
      type: assessment.passingRule?.type || 'correct_count',
      value: assessment.passingRule?.value ?? 5,
    },
    maxAttempts: assessment.maxAttempts,
    retakeCooldownHours: assessment.retakeCooldownHours,
    timeLimitMinutes: assessment.timeLimitMinutes,
    vivaRequired: assessment.vivaRequired,
  };
};

const isMcqCorrect = (question, answer) => {
  const normalizedAnswer = normalizeText(answer);
  if (!normalizedAnswer) return false;

  const correctOptionKey = normalizeText(question.correctOptionKey);
  if (correctOptionKey && normalizedAnswer === correctOptionKey) return true;

  const correctOption = (question.options || []).find(
    (option) => normalizeText(option.key) === correctOptionKey
  );

  return Boolean(correctOption && normalizedAnswer === normalizeText(correctOption.text));
};

const isShortAnswerCorrect = (question, answer) => {
  const normalizedAnswer = normalizeText(answer);
  const acceptedAnswers = normalizeAnswerList(question.acceptedAnswers);
  if (!normalizedAnswer || !acceptedAnswers.length) return false;

  if (question.gradingMode === 'contains') {
    return acceptedAnswers.some((accepted) => normalizedAnswer.includes(accepted));
  }

  return acceptedAnswers.includes(normalizedAnswer);
};

export const gradeAssessmentAnswers = (assessment, submittedAnswers = {}) => {
  const questions = getEnabledQuestions(assessment);
  const answers = submittedAnswers && typeof submittedAnswers === 'object'
    ? submittedAnswers
    : {};

  let correctCount = 0;
  let score = 0;
  let maxScore = 0;
  let hasManualPending = false;

  const gradedAnswers = questions.map((question) => {
    const questionId = String(question._id);
    const answer = answers[questionId] ?? answers[question._id] ?? null;
    const points = Number(question.points || 0);
    maxScore += points;

    if (question.type === 'descriptive') {
      hasManualPending = true;
      return {
        questionId: question._id,
        questionType: question.type,
        answer,
        awardedPoints: 0,
        isCorrect: null,
        gradingStatus: 'manual_pending',
        feedback: '',
        gradedBy: null,
        gradedAt: null,
      };
    }

    if (question.type === 'short_answer') {
      const shouldAutoGrade =
        question.gradingMode !== 'manual'
        && normalizeAnswerList(question.acceptedAnswers).length > 0;

      if (!shouldAutoGrade) {
        hasManualPending = true;
        return {
          questionId: question._id,
          questionType: question.type,
          answer,
          awardedPoints: 0,
          isCorrect: null,
          gradingStatus: 'manual_pending',
          feedback: '',
          gradedBy: null,
          gradedAt: null,
        };
      }

      const correct = isShortAnswerCorrect(question, answer);
      if (correct) {
        correctCount += 1;
        score += points;
      }

      return {
        questionId: question._id,
        questionType: question.type,
        answer,
        awardedPoints: correct ? points : 0,
        isCorrect: correct,
        gradingStatus: 'auto_graded',
        feedback: '',
        gradedBy: null,
        gradedAt: null,
      };
    }

    const correct = isMcqCorrect(question, answer);
    if (correct) {
      correctCount += 1;
      score += points;
    }

    return {
      questionId: question._id,
      questionType: 'mcq',
      answer,
      awardedPoints: correct ? points : 0,
      isCorrect: correct,
      gradingStatus: 'auto_graded',
      feedback: '',
      gradedBy: null,
      gradedAt: null,
    };
  });

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passingRule = assessment?.passingRule || { type: 'correct_count', value: 5 };
  const meetsThreshold = passingRule.type === 'percentage'
    ? percentage >= Number(passingRule.value || 0)
    : correctCount >= Number(passingRule.value || 0);

  return {
    answers: gradedAnswers,
    correctCount,
    totalQuestions: questions.length,
    score,
    maxScore,
    percentage,
    passed: hasManualPending ? null : meetsThreshold,
    status: hasManualPending ? 'pending_manual' : 'graded',
    hasManualPending,
  };
};

export const recalculateAttemptResult = (
  assessment,
  gradedAnswers = [],
  snapshot = {}
) => {
  const maxScore = snapshot.maxScore !== undefined
    ? Number(snapshot.maxScore || 0)
    : (assessment?.questions || [])
      .filter((question) => question.isEnabled !== false)
      .reduce((sum, question) => sum + Number(question.points || 0), 0);

  const totalQuestions = snapshot.totalQuestions !== undefined
    ? Number(snapshot.totalQuestions || 0)
    : (assessment?.questions || []).filter(
      (question) => question.isEnabled !== false
    ).length;

  const pending = gradedAnswers.some((answer) => answer.gradingStatus === 'manual_pending');
  const correctCount = gradedAnswers.filter((answer) => answer.isCorrect === true).length;
  const score = gradedAnswers.reduce(
    (sum, answer) => sum + Number(answer.awardedPoints || 0),
    0
  );
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passingRule = assessment?.passingRule || { type: 'correct_count', value: 5 };
  const meetsThreshold = passingRule.type === 'percentage'
    ? percentage >= Number(passingRule.value || 0)
    : correctCount >= Number(passingRule.value || 0);

  return {
    correctCount,
    totalQuestions,
    score,
    maxScore,
    percentage,
    passed: pending ? null : meetsThreshold,
    status: pending ? 'pending_manual' : 'graded',
    hasManualPending: pending,
  };
};
