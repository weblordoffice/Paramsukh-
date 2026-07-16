import { Certificate } from '../models/certificate.models.js';
import { Course } from '../models/course.models.js';
import { User } from '../models/user.models.js';
import crypto from 'crypto';

/**
 * Checks and creates a digital certificate record for a user upon course completion
 */
export const generateCertificateRecord = async (userId, courseId) => {
  try {
    let certificate = await Certificate.findOne({ user: userId, course: courseId });
    if (certificate) return certificate;

    const [user, course] = await Promise.all([
      User.findById(userId),
      Course.findById(courseId)
    ]);

    if (!user || !course) {
      throw new Error('User or Course not found');
    }

    // Generate unique verifiable certificate code
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const certificateId = `PS-CERT-${randomHex}-${Date.now().toString().slice(-4)}`;

    certificate = new Certificate({
      certificateId,
      user: userId,
      course: courseId,
      issuedTo: user.displayName,
      courseName: course.title,
      issuedAt: new Date()
    });

    await certificate.save();
    console.log(`🎓 Certificate generated: ${certificateId} for user ${user.displayName}`);

    return certificate;
  } catch (error) {
    console.error('❌ Error generating certificate:', error);
    throw error;
  }
};
