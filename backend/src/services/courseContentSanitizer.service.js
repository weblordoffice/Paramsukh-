const toPlain = (value) => {
  if (!value) return value;
  return typeof value.toObject === 'function' ? value.toObject() : value;
};

const sanitizeQuestion = (question) => {
  const plain = toPlain(question) || {};
  const { correctAnswer, explanation, ...safeQuestion } = plain;
  return safeQuestion;
};

export const sanitizeAssignmentForUser = (assignment) => {
  const plain = toPlain(assignment);
  if (!plain) return plain;

  return {
    ...plain,
    questions: (plain.questions || []).map(sanitizeQuestion),
  };
};

export const sanitizeCourseForUser = (course) => {
  const plain = toPlain(course);
  if (!plain) return plain;

  return {
    ...plain,
    assignments: (plain.assignments || []).map(sanitizeAssignmentForUser),
    videos: (plain.videos || []).map((video) => ({
      ...toPlain(video),
      assignments: (toPlain(video)?.assignments || []).map(sanitizeAssignmentForUser),
    })),
  };
};
