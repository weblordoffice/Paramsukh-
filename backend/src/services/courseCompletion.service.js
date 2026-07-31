import { Course } from '../models/course.models.js';
import { generateCertificateRecord } from './certificate.service.js';

export const handleCourseCompletion = async (userId, courseId) => {
  await Course.findByIdAndUpdate(courseId, { $inc: { completionCount: 1 } });

  const cert = await generateCertificateRecord(userId, courseId);

  try {
    const { User } = await import('../models/user.models.js');
    const user = await User.findById(userId).select('referredBy');
    if (user && user.referredBy) {
      const { fireTrigger } = await import('./referral.service.js');
      fireTrigger('user.course_complete', { referrerId: user.referredBy, referredUserId: userId });
    }
  } catch (e) {
    console.error('Referral trigger failed on completion:', e.message);
  }

  try {
    const { unlockBadgesForUser } = await import('./badgeUnlockingService.js');
    await unlockBadgesForUser(userId);
  } catch (e) {
    console.error('Badge unlocking failed on completion:', e.message);
  }

  try {
    const { sendCertificateEarnedEmail } = await import('./emailService.js');
    const { User } = await import('../models/user.models.js');
    const user = await User.findById(userId).select('email displayName');
    sendCertificateEarnedEmail(user, cert.courseName, cert.certificateId);
  } catch (e) {
    console.error('Certificate email failed:', e.message);
  }

  return cert;
};
