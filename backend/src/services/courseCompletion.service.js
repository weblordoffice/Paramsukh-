import { Course } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { issueParticipationCertificate } from './certificate.service.js';

export const handleCourseCompletion = async (userId, courseId) => {
  const enrollment = await Enrollment.findOne({ userId, courseId }).select(
    'isCompleted completionAwardedAt'
  );

  let isFirstCompletion = false;

  if (enrollment?.isCompleted && !enrollment.completionAwardedAt) {
    const claimed = await Enrollment.findOneAndUpdate(
      { _id: enrollment._id, completionAwardedAt: null },
      { $set: { completionAwardedAt: new Date() } },
      { new: true }
    );
    isFirstCompletion = Boolean(claimed);
  }

  if (isFirstCompletion) {
    await Course.findByIdAndUpdate(courseId, { $inc: { completionCount: 1 } });
  }

  const cert = await issueParticipationCertificate(userId, courseId);

  if (isFirstCompletion) {
    try {
      const { User } = await import('../models/user.models.js');
      const user = await User.findById(userId).select('referredBy');
      if (user && user.referredBy) {
        const { fireTrigger } = await import('./referral.service.js');
        await fireTrigger('user.course_complete', {
          referrerId: user.referredBy,
          referredUserId: userId,
        });
      }
    } catch (e) {
      console.error('Referral trigger failed on completion:', e.message);
    }
  }

  try {
    const { unlockBadgesForUser } = await import('./badgeUnlockingService.js');
    await unlockBadgesForUser(userId);
  } catch (e) {
    console.error('Badge unlocking failed on completion:', e.message);
  }

  if (isFirstCompletion) {
    try {
      const { sendCertificateEarnedEmail } = await import('./emailService.js');
      const { User } = await import('../models/user.models.js');
      const user = await User.findById(userId).select('email displayName');
      sendCertificateEarnedEmail(user, cert.courseName, cert.certificateId);
    } catch (e) {
      console.error('Certificate email failed:', e.message);
    }
  }

  return cert;
};
