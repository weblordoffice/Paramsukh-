import { Course } from '../../models/course.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { Assignment } from '../../models/course.models.js';
import { CourseActivitySubmission } from '../../models/courseActivitySubmission.models.js';
import { notifyCourseContentAdded } from '../../services/notificationAutomation.service.js';
import { recordRequiredAssignmentCompletion } from '../../services/certificationEligibility.service.js';

const normalize = (value) => String(value ?? '').trim().toLowerCase();

const getCourseTotals = (course) => ({
  videos: (course.videos || []).length,
  pdfs: (course.pdfs || []).length,
  audioLessons: (course.audioLessons || []).length,
  reflections: (course.reflections || []).filter((reflection) => reflection.isRequired !== false).length,
});

const updateEnrollmentProgress = (enrollment, course) => {
  const totals = getCourseTotals(course);
  enrollment.updateProgress(totals.videos, totals.pdfs, totals.audioLessons, totals.reflections);
};

const afterProgressChange = async (userId, courseId, enrollment) => {
  if (enrollment.isCompleted) {
    try {
      const { handleCourseCompletion } = await import('../../services/courseCompletion.service.js');
      await handleCourseCompletion(userId, courseId);
    } catch (error) {
      console.error('Post-completion hook failed:', error.message);
    }
  }

  try {
    const { unlockBadgesForUser } = await import('../../services/badgeUnlockingService.js');
    await unlockBadgesForUser(userId);
  } catch (error) {
    console.error('Badge update failed:', error.message);
  }
};

const formatAudioLesson = (lesson, completedIds) => ({
  ...lesson,
  isCompleted: completedIds.has(String(lesson._id)),
});

const formatReflection = (reflection, completedIds, submission) => ({
  ...reflection,
  isCompleted: completedIds.has(String(reflection._id)),
  submission: submission || null,
});

/**
 * GET /api/courses/:courseId/audio-lessons
 */
export const getCourseAudioLessons = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId).select('audioLessons').lean();
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const enrollment = await Enrollment.findOne({
      userId: req.user._id,
      courseId: req.params.courseId,
    }).select('completedAudioLessons').lean();

    const completedIds = new Set((enrollment?.completedAudioLessons || []).map(String));

    return res.status(200).json({
      success: true,
      audioLessons: (course.audioLessons || [])
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((lesson) => formatAudioLesson(lesson, completedIds)),
    });
  } catch (error) {
    console.error('Get Course Audio Lessons Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load audio lessons', error: error.message });
  }
};

const validateAudioPayload = (body, existing = null) => {
  const title = body.title !== undefined ? String(body.title || '').trim() : existing?.title;
  const audioUrl = body.audioUrl !== undefined ? String(body.audioUrl || '').trim() : existing?.audioUrl;
  const description = body.description !== undefined ? String(body.description || '').trim() : (existing?.description || '');
  const duration = body.duration !== undefined ? String(body.duration || '').trim() : (existing?.duration || '');
  const durationInSeconds = body.durationInSeconds !== undefined ? Number(body.durationInSeconds) : Number(existing?.durationInSeconds || 0);
  const thumbnailUrl = body.thumbnailUrl !== undefined ? String(body.thumbnailUrl || '').trim() || null : (existing?.thumbnailUrl || null);
  const order = body.order !== undefined ? Number(body.order) : Number(existing?.order || 0);
  const isFree = body.isFree !== undefined ? body.isFree === true : existing?.isFree === true;

  if (!title) return { error: 'Audio title is required' };
  if (!audioUrl) return { error: 'Audio URL is required' };
  if (!Number.isFinite(order) || order < 0) return { error: 'Invalid order' };

  return {
    value: { title, description, audioUrl, duration, durationInSeconds: Number.isFinite(durationInSeconds) ? durationInSeconds : 0, thumbnailUrl, order, isFree },
  };
};

/**
 * POST /api/courses/:courseId/audio-lessons (admin)
 */
export const addAudioLesson = async (req, res) => {
  try {
    const validated = validateAudioPayload(req.body);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });

    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    course.audioLessons.push(validated.value);
    await course.save();

    notifyCourseContentAdded(course, 'audio lesson', validated.value.title).catch((error) =>
      console.error('Course content notification failed:', error?.message)
    );

    return res.status(201).json({
      success: true,
      message: 'Audio lesson added',
      audioLesson: course.audioLessons[course.audioLessons.length - 1],
    });
  } catch (error) {
    console.error('Add Audio Lesson Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add audio lesson', error: error.message });
  }
};

/**
 * PUT /api/courses/:courseId/audio-lessons/:audioId (admin)
 */
export const updateAudioLesson = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const audioLesson = course.audioLessons.id(req.params.audioId);
    if (!audioLesson) return res.status(404).json({ success: false, message: 'Audio lesson not found' });

    const validated = validateAudioPayload(req.body, audioLesson.toObject());
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });

    Object.assign(audioLesson, validated.value);
    await course.save();

    return res.status(200).json({ success: true, message: 'Audio lesson updated', audioLesson });
  } catch (error) {
    console.error('Update Audio Lesson Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update audio lesson', error: error.message });
  }
};

/**
 * DELETE /api/courses/:courseId/audio-lessons/:audioId (admin)
 */
export const deleteAudioLesson = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const audioLesson = course.audioLessons.id(req.params.audioId);
    if (!audioLesson) return res.status(404).json({ success: false, message: 'Audio lesson not found' });

    course.audioLessons.pull(req.params.audioId);
    await course.save();

    return res.status(200).json({ success: true, message: 'Audio lesson deleted' });
  } catch (error) {
    console.error('Delete Audio Lesson Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete audio lesson', error: error.message });
  }
};

/**
 * GET /api/courses/:courseId/reflections
 */
export const getCourseReflections = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId).select('reflections').lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const reflectionIds = (course.reflections || []).map((reflection) => reflection._id);
    const [enrollment, submissions] = await Promise.all([
      Enrollment.findOne({ userId: req.user._id, courseId: req.params.courseId })
        .select('completedReflections')
        .lean(),
      CourseActivitySubmission.find({
        userId: req.user._id,
        courseId: req.params.courseId,
        type: 'reflection',
        reflectionId: { $in: reflectionIds },
      }).sort({ submittedAt: -1 }).lean(),
    ]);

    const completedIds = new Set((enrollment?.completedReflections || []).map(String));
    const submissionByReflection = new Map();
    submissions.forEach((submission) => {
      const key = String(submission.reflectionId);
      if (!submissionByReflection.has(key)) submissionByReflection.set(key, submission);
    });

    return res.status(200).json({
      success: true,
      reflections: (course.reflections || [])
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((reflection) => formatReflection(
          reflection,
          completedIds,
          submissionByReflection.get(String(reflection._id)) || null
        )),
    });
  } catch (error) {
    console.error('Get Course Reflections Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load reflections', error: error.message });
  }
};

const validateReflectionPayload = (body, existing = null) => {
  const title = body.title !== undefined ? String(body.title || '').trim() : existing?.title;
  const prompt = body.prompt !== undefined ? String(body.prompt || '').trim() : existing?.prompt;
  const guidance = body.guidance !== undefined ? String(body.guidance || '').trim() : (existing?.guidance || '');
  const minWords = body.minWords !== undefined ? Number(body.minWords) : Number(existing?.minWords || 20);
  const order = body.order !== undefined ? Number(body.order) : Number(existing?.order || 0);
  const isRequired = body.isRequired !== undefined ? body.isRequired === true : existing?.isRequired !== false;

  if (!title) return { error: 'Reflection title is required' };
  if (!prompt) return { error: 'Reflection prompt is required' };
  if (!Number.isFinite(minWords) || minWords < 1) return { error: 'Minimum words must be at least 1' };
  if (!Number.isFinite(order) || order < 0) return { error: 'Invalid order' };

  return { value: { title, prompt, guidance, minWords: Math.round(minWords), order, isRequired } };
};

/**
 * POST /api/courses/:courseId/reflections (admin)
 */
export const addReflection = async (req, res) => {
  try {
    const validated = validateReflectionPayload(req.body);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });

    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    course.reflections.push(validated.value);
    await course.save();

    notifyCourseContentAdded(course, 'reflection exercise', validated.value.title).catch((error) =>
      console.error('Course content notification failed:', error?.message)
    );

    return res.status(201).json({
      success: true,
      message: 'Reflection added',
      reflection: course.reflections[course.reflections.length - 1],
    });
  } catch (error) {
    console.error('Add Reflection Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add reflection', error: error.message });
  }
};

/**
 * PUT /api/courses/:courseId/reflections/:reflectionId (admin)
 */
export const updateReflection = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const reflection = course.reflections.id(req.params.reflectionId);
    if (!reflection) return res.status(404).json({ success: false, message: 'Reflection not found' });

    const validated = validateReflectionPayload(req.body, reflection.toObject());
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });

    Object.assign(reflection, validated.value);
    await course.save();

    return res.status(200).json({ success: true, message: 'Reflection updated', reflection });
  } catch (error) {
    console.error('Update Reflection Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update reflection', error: error.message });
  }
};

/**
 * DELETE /api/courses/:courseId/reflections/:reflectionId (admin)
 */
export const deleteReflection = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const reflection = course.reflections.id(req.params.reflectionId);
    if (!reflection) return res.status(404).json({ success: false, message: 'Reflection not found' });

    course.reflections.pull(req.params.reflectionId);
    await course.save();

    return res.status(200).json({ success: true, message: 'Reflection deleted' });
  } catch (error) {
    console.error('Delete Reflection Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete reflection', error: error.message });
  }
};

/**
 * POST /api/courses/:courseId/reflections/:reflectionId/submit
 */
export const submitReflection = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId, reflectionId } = req.params;
    const responseText = String(req.body.response || '').trim();

    const [course, enrollment] = await Promise.all([
      Course.findById(courseId).select('reflections videos pdfs audioLessons'),
      Enrollment.findOne({ userId, courseId }),
    ]);

    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!enrollment) return res.status(403).json({ success: false, message: 'Enroll in this course first' });

    const reflection = course.reflections.id(reflectionId);
    if (!reflection) return res.status(404).json({ success: false, message: 'Reflection not found' });

    const wordCount = responseText.split(/\s+/).filter(Boolean).length;
    if (wordCount < (reflection.minWords || 1)) {
      return res.status(400).json({
        success: false,
        message: `Please write at least ${reflection.minWords} words`,
      });
    }

    const existing = await CourseActivitySubmission.findOne({
      userId,
      courseId,
      type: 'reflection',
      reflectionId,
    });

    const submission = await CourseActivitySubmission.findOneAndUpdate(
      { userId, courseId, type: 'reflection', reflectionId },
      {
        $set: {
          response: responseText,
          submittedAt: new Date(),
          attemptNumber: (existing?.attemptNumber || 0) + 1,
        },
        $setOnInsert: { userId, courseId, type: 'reflection', reflectionId },
      },
      { upsert: true, new: true }
    );

    enrollment.markReflectionComplete(reflection._id);
    enrollment.lastAccessedAt = new Date();
    updateEnrollmentProgress(enrollment, course);
    await enrollment.save();

    await afterProgressChange(userId, courseId, enrollment);

    return res.status(200).json({
      success: true,
      message: 'Reflection submitted',
      submission,
      progress: enrollment.progress,
      isCompleted: enrollment.isCompleted,
    });
  } catch (error) {
    console.error('Submit Reflection Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit reflection', error: error.message });
  }
};

const assignmentBelongsToCourse = (course, assignmentId) => {
  if ((course.assignments || []).some((id) => String(id) === String(assignmentId))) return true;
  return (course.videos || []).some((video) =>
    (video.assignments || []).some((id) => String(id) === String(assignmentId))
  );
};

/**
 * GET /api/courses/:courseId/assignments/:assignmentId/attempts
 */
export const getAssignmentAttempts = async (req, res) => {
  try {
    const attempts = await CourseActivitySubmission.find({
      userId: req.user._id,
      courseId: req.params.courseId,
      type: 'quiz',
      assignmentId: req.params.assignmentId,
    }).sort({ submittedAt: -1 }).lean();

    const best = attempts.reduce((bestAttempt, attempt) => {
      if (!bestAttempt) return attempt;
      return (attempt.percentage || 0) > (bestAttempt.percentage || 0) ? attempt : bestAttempt;
    }, null);

    return res.status(200).json({ success: true, attempts, best });
  } catch (error) {
    console.error('Get Assignment Attempts Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load attempts', error: error.message });
  }
};

/**
 * POST /api/courses/:courseId/assignments/:assignmentId/submit
 */
export const submitAssignment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId, assignmentId } = req.params;
    const answers = req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : {};

    const [course, enrollment, assignment] = await Promise.all([
      Course.findById(courseId).select('assignments videos'),
      Enrollment.findOne({ userId, courseId }),
      Assignment.findById(assignmentId),
    ]);

    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!enrollment) return res.status(403).json({ success: false, message: 'Enroll in this course first' });
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    if (!assignmentBelongsToCourse(course, assignmentId)) {
      return res.status(400).json({ success: false, message: 'Assignment does not belong to this course' });
    }

    const questions = assignment.questions || [];
    let score = 0;
    let graded = 0;

    questions.forEach((question) => {
      const userAnswer = answers[String(question._id)] ?? answers[question._id];
      const correct = question.correctAnswer;
      if (correct === undefined || correct === null || String(correct).trim() === '') return;
      graded += 1;
      if (normalize(userAnswer) && normalize(userAnswer) === normalize(correct)) {
        score += 1;
      }
    });

    const maxScore = graded;
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const passed = maxScore > 0 && percentage >= 60;
    const existingCount = await CourseActivitySubmission.countDocuments({
      userId,
      courseId,
      type: 'quiz',
      assignmentId,
    });

    const submission = await CourseActivitySubmission.create({
      userId,
      courseId,
      type: 'quiz',
      assignmentId,
      answers,
      score,
      maxScore,
      percentage,
      passed,
      attemptNumber: existingCount + 1,
      submittedAt: new Date(),
    });

    const attempts = await CourseActivitySubmission.find({
      userId,
      courseId,
      type: 'quiz',
      assignmentId,
    }).sort({ submittedAt: -1 }).lean();

    const best = attempts.reduce((bestAttempt, attempt) => {
      if (!bestAttempt) return attempt;
      return (attempt.percentage || 0) > (bestAttempt.percentage || 0) ? attempt : bestAttempt;
    }, null);

    await recordRequiredAssignmentCompletion(userId, courseId, assignmentId).catch((err) =>
      console.error('Assessment unlock recalculation failed:', err.message)
    );

    return res.status(201).json({
      success: true,
      message: 'Quiz submitted',
      submission,
      attempts,
      best,
    });
  } catch (error) {
    console.error('Submit Assignment Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit quiz', error: error.message });
  }
};

/**
 * Admin: quiz submissions for an assignment.
 */
export const getAssignmentSubmissionsAdmin = async (req, res) => {
  try {
    const submissions = await CourseActivitySubmission.find({
      courseId: req.params.courseId,
      type: 'quiz',
      assignmentId: req.params.assignmentId,
    })
      .populate('userId', 'displayName email phone')
      .sort({ submittedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, submissions });
  } catch (error) {
    console.error('Get Assignment Submissions Admin Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load submissions', error: error.message });
  }
};

/**
 * Admin: reflection submissions for a course.
 */
export const getReflectionSubmissionsAdmin = async (req, res) => {
  try {
    const submissions = await CourseActivitySubmission.find({
      courseId: req.params.courseId,
      type: 'reflection',
    })
      .populate('userId', 'displayName email phone')
      .sort({ submittedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, submissions });
  } catch (error) {
    console.error('Get Reflection Submissions Admin Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load submissions', error: error.message });
  }
};
