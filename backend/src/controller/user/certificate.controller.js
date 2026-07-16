import { Certificate } from '../../models/certificate.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { generateCertificateRecord } from '../../services/certificate.service.js';

/**
 * Get all certificates earned by the authenticated user
 */
export const getUserCertificates = async (req, res) => {
  try {
    const userId = req.user._id;
    const certificates = await Certificate.find({ user: userId }).sort({ issuedAt: -1 });

    return res.status(200).json({
      success: true,
      certificates
    });
  } catch (error) {
    console.error('❌ Get user certificates error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error fetching certificates.',
      error: error.message
    });
  }
};

/**
 * Manually generate/claim a certificate for a 100% completed course
 */
export const generateCertificate = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment || !enrollment.isCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Course must be 100% completed to claim a certificate.'
      });
    }

    const certificate = await generateCertificateRecord(userId, courseId);

    return res.status(200).json({
      success: true,
      message: 'Certificate generated successfully.',
      certificate
    });
  } catch (error) {
    console.error('❌ Claim certificate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error generating certificate.',
      error: error.message
    });
  }
};
