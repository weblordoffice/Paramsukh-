import mongoose from 'mongoose';
import { UserMembership } from '../models/userMembership.models.js';
import { Transaction } from '../models/transaction.models.js';
import { User } from '../models/user.models.js';
import { Course, Assignment } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { CourseActivitySubmission } from '../models/courseActivitySubmission.models.js';

const PAID_MEMBERSHIP_SOURCES = new Set(['purchase', 'renewal', 'upgrade']);
const PAID_PAYMENT_PROVIDERS = new Set(['razorpay', 'manual']);

const toId = (value) => String(value?._id || value || '');

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPaymentReferences = (membership) => {
  const payment = membership?.payment || {};
  const metadata = membership?.metadata || {};

  return [
    payment.paymentId,
    payment.orderId,
    metadata.paymentId,
    metadata.orderId,
    metadata.razorpayPaymentId,
    metadata.razorpayOrderId,
    metadata.paymentLinkId,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
};

export const getMembershipPeriodKey = (membership) => {
  const start = toDate(membership?.startDate) || toDate(membership?.createdAt) || new Date();
  return start.toISOString().slice(0, 10);
};

export const getMembershipIssuanceKey = (membership) => {
  if (!membership?._id) return null;
  return `membership:${toId(membership._id)}:${getMembershipPeriodKey(membership)}`;
};

const hasDirectPaymentProof = (membership) => {
  const payment = membership?.payment || {};
  const amount = Number(payment.amount || 0);
  const provider = String(payment.provider || '').toLowerCase();

  return (
    PAID_PAYMENT_PROVIDERS.has(provider)
    && amount > 0
    && Boolean(String(payment.paymentId || payment.orderId || '').trim())
  );
};

const hasLinkedPaymentRecord = async (userId, membership) => {
  const references = getPaymentReferences(membership);
  if (!references.length) return false;

  const referenceQuery = {
    $or: [
      { providerRef: { $in: references } },
      { sourceId: { $in: references } },
      { 'metadata.paymentId': { $in: references } },
      { 'metadata.orderId': { $in: references } },
    ],
  };

  const [transaction, user] = await Promise.all([
    Transaction.findOne({
      userId,
      source: 'membership',
      status: 'success',
      amount: { $gt: 0 },
      ...referenceQuery,
    }).select('_id').lean(),
    User.findOne({
      _id: userId,
      payments: {
        $elemMatch: {
          status: 'completed',
          amount: { $gt: 0 },
          $or: [
            { paymentId: { $in: references } },
            { orderId: { $in: references } },
          ],
        },
      },
    }).select('_id').lean(),
  ]);

  return Boolean(transaction || user);
};

export const isPaidMembershipForCertificate = async (membership, userId = null) => {
  if (!membership) return false;

  const resolvedUserId = userId || membership.userId;
  const source = String(membership.source || '').toLowerCase();
  if (!PAID_MEMBERSHIP_SOURCES.has(source)) return false;

  if (String(membership.status || '').toLowerCase() !== 'active') return false;

  const endDate = toDate(membership.endDate);
  if (endDate && endDate.getTime() < Date.now()) return false;

  if (hasDirectPaymentProof(membership)) return true;

  return hasLinkedPaymentRecord(resolvedUserId, membership);
};

export const getMembershipCertificateEligibility = async (userId) => {
  const memberships = await UserMembership.find({
    userId,
    status: 'active',
    endDate: { $gte: new Date() },
  })
    .sort({ endDate: -1, createdAt: -1 })
    .lean();

  if (!memberships.length) {
    return {
      eligible: false,
      reason: 'No active membership found.',
      membership: null,
      periodKey: null,
    };
  }

  for (const membership of memberships) {
    if (await isPaidMembershipForCertificate(membership, userId)) {
      return {
        eligible: true,
        reason: null,
        membership,
        periodKey: getMembershipPeriodKey(membership),
      };
    }
  }

  const hasNonPaidMembership = memberships.some((membership) =>
    ['admin_grant', 'migration'].includes(String(membership.source || '').toLowerCase())
  );

  return {
    eligible: false,
    reason: hasNonPaidMembership
      ? 'This membership was not purchased, so it does not qualify for a membership certificate.'
      : 'No verified paid membership transaction was found for the active membership.',
    membership: memberships[0],
    periodKey: null,
  };
};

const getCourseRequiredAssignments = async (course) => {
  const assignmentIds = new Set();
  (course.assignments || []).forEach((id) => assignmentIds.add(toId(id)));
  (course.videos || []).forEach((video) => {
    (video.assignments || []).forEach((id) => assignmentIds.add(toId(id)));
  });

  const ids = [...assignmentIds].filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return [];

  return Assignment.find({
    _id: { $in: ids },
    requiredForAssessment: true,
  })
    .select('_id title')
    .lean();
};

const getCourseCompletionSnapshot = async (userId, courseId) => {
  const [course, enrollment] = await Promise.all([
    Course.findById(courseId)
      .select('title videos pdfs audioLessons reflections assignments')
      .lean(),
    Enrollment.findOne({ userId, courseId }).lean(),
  ]);

  if (!course) {
    return { course: null, enrollment: null, enrolled: false, learningComplete: false, remaining: [] };
  }

  if (!enrollment) {
    return {
      course,
      enrollment: null,
      enrolled: false,
      learningComplete: false,
      requiredAssignmentsComplete: false,
      assessmentUnlocked: false,
      remaining: [{ type: 'enrollment', title: 'Enroll in this course' }],
    };
  }

  const completedVideos = new Set((enrollment.completedVideos || []).map(toId));
  const completedPdfs = new Set((enrollment.completedPdfs || []).map(toId));
  const completedAudio = new Set((enrollment.completedAudioLessons || []).map(toId));
  const completedReflections = new Set((enrollment.completedReflections || []).map(toId));

  const requiredVideos = (course.videos || []).filter((video) => toId(video._id));
  const requiredPdfs = (course.pdfs || []).filter((pdf) => toId(pdf._id));
  const requiredAudio = (course.audioLessons || []).filter((audio) => toId(audio._id));
  const requiredReflections = (course.reflections || []).filter(
    (reflection) => reflection.isRequired !== false && toId(reflection._id)
  );

  const remaining = [];

  const missingVideos = requiredVideos.filter((video) => !completedVideos.has(toId(video._id)));
  const missingPdfs = requiredPdfs.filter((pdf) => !completedPdfs.has(toId(pdf._id)));
  const missingAudio = requiredAudio.filter((audio) => !completedAudio.has(toId(audio._id)));
  const missingReflections = requiredReflections.filter(
    (reflection) => !completedReflections.has(toId(reflection._id))
  );

  missingVideos.forEach((video) => remaining.push({
    type: 'video',
    id: toId(video._id),
    title: video.title,
  }));
  missingPdfs.forEach((pdf) => remaining.push({
    type: 'pdf',
    id: toId(pdf._id),
    title: pdf.title,
  }));
  missingAudio.forEach((audio) => remaining.push({
    type: 'audio',
    id: toId(audio._id),
    title: audio.title,
  }));
  missingReflections.forEach((reflection) => remaining.push({
    type: 'reflection',
    id: toId(reflection._id),
    title: reflection.title,
  }));

  const requiredAssignments = await getCourseRequiredAssignments(course);
  const requiredAssignmentIds = requiredAssignments.map((assignment) => assignment._id);
  let completedRequiredAssignments = [];

  if (requiredAssignmentIds.length) {
    const passedSubmissions = await CourseActivitySubmission.find({
      userId,
      courseId,
      type: 'quiz',
      assignmentId: { $in: requiredAssignmentIds },
      passed: true,
    })
      .select('assignmentId')
      .lean();

    completedRequiredAssignments = [...new Set(
      passedSubmissions.map((submission) => toId(submission.assignmentId))
    )];

    const completedAssignmentSet = new Set(completedRequiredAssignments);
    requiredAssignments
      .filter((assignment) => !completedAssignmentSet.has(toId(assignment._id)))
      .forEach((assignment) => remaining.push({
        type: 'assignment',
        id: toId(assignment._id),
        title: assignment.title,
      }));
  }

  const totalLearningItems =
    requiredVideos.length
    + requiredPdfs.length
    + requiredAudio.length
    + requiredReflections.length;

  const completedLearningItems =
    requiredVideos.length - missingVideos.length
    + requiredPdfs.length - missingPdfs.length
    + requiredAudio.length - missingAudio.length
    + requiredReflections.length - missingReflections.length;

  const learningComplete = totalLearningItems === 0
    ? Boolean(enrollment.isCompleted)
    : completedLearningItems === totalLearningItems;
  const requiredAssignmentsComplete = requiredAssignments.length === 0
    || completedRequiredAssignments.length === requiredAssignments.length;

  return {
    course,
    enrollment,
    enrolled: true,
    learningComplete,
    requiredAssignmentsComplete,
    completedRequiredAssignments,
    assessmentUnlocked: learningComplete && requiredAssignmentsComplete,
    remaining,
    totalLearningItems,
    completedLearningItems,
  };
};

export const getCourseCertificationEligibility = async (userId, courseId) => {
  const snapshot = await getCourseCompletionSnapshot(userId, courseId);

  return {
    ...snapshot,
    participationEligible: Boolean(snapshot.enrolled && snapshot.learningComplete),
  };
};

export const recalculateAssessmentUnlock = async (userId, courseId) => {
  const snapshot = await getCourseCompletionSnapshot(userId, courseId);

  if (snapshot.enrolled && snapshot.enrollment) {
    const update = {
      $set: {
        assessmentUnlocked: Boolean(snapshot.assessmentUnlocked),
        lastEligibilityCheckAt: new Date(),
        completedRequiredAssignments: snapshot.completedRequiredAssignments || [],
      },
    };

    if (snapshot.assessmentUnlocked) {
      update.$set.assessmentUnlockedAt =
        snapshot.enrollment.assessmentUnlockedAt || new Date();
    } else {
      update.$set.assessmentUnlockedAt = null;
    }

    await Enrollment.updateOne({ _id: snapshot.enrollment._id }, update);
  }

  return snapshot;
};

export const recordRequiredAssignmentCompletion = async (userId, courseId, assignmentId) => {
  const [course, assignment, enrollment] = await Promise.all([
    Course.findById(courseId).select('videos assignments').lean(),
    Assignment.findById(assignmentId).select('_id title requiredForAssessment').lean(),
    Enrollment.findOne({ userId, courseId }),
  ]);

  if (!enrollment) return null;

  const assignmentBelongs = Boolean(
    assignment
    && (
      (course?.assignments || []).some((id) => toId(id) === toId(assignmentId))
      || (course?.videos || []).some((video) =>
        (video.assignments || []).some((id) => toId(id) === toId(assignmentId))
      )
    )
  );

  if (!assignmentBelongs || !assignment?.requiredForAssessment) {
    return recalculateAssessmentUnlock(userId, courseId);
  }

  const hasPassed = await CourseActivitySubmission.exists({
    userId,
    courseId,
    type: 'quiz',
    assignmentId,
    passed: true,
  });

  if (hasPassed) {
    enrollment.markRequiredAssignmentComplete(assignmentId);
    await enrollment.save();
  }

  return recalculateAssessmentUnlock(userId, courseId);
};
