import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth, getAdminFromRequest, isValidAdminApiKey } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import {
  uploadSingleImage as uploadSingleImageMiddleware,
  uploadMultipleImages as uploadMultipleImagesMiddleware,
  uploadSingleVideo,
  uploadSingleAudio,
  uploadSinglePdf,
  uploadProfilePhoto as uploadProfilePhotoMiddleware,
  uploadCertificateTemplateBackground,
  handleMulterError
} from '../../middleware/uploadMiddleware.js';
import {
  uploadSingleImage,
  uploadImages,
  uploadProfilePhoto,
  uploadVideoFile,
  uploadAudioFile,
  getVideoPresignedUrl,
  uploadPdfFile,
  uploadProductImages,
  uploadCourseMedia,
  uploadCertificateTemplate,
  deleteUploadedFile,
  getUploadStatus
} from '../../controller/upload/upload.controller.js';

const router = express.Router();

// Helper middleware to allow either an Admin (JWT/API key) or a User token
const adminOrUserAuth = async (req, res, next) => {
  const admin = await getAdminFromRequest(req);
  if (admin) {
    req.admin = admin;
    return next();
  }

  if (isValidAdminApiKey(req)) {
    req.isAdminApiKey = true;
    return next();
  }

  return protectedRoutes(req, res, next);
};

// ========================================
// Upload Status (Public)
// ========================================

// Check if running in test mode or production
// GET /api/upload/status
router.get('/status', getUploadStatus);

// ========================================
// Image Upload Routes (Protected or Admin)
// ========================================

// Upload single image (general purpose)
// POST /api/upload/image
// @multipart file: image
// @query folder: optional folder name
router.post('/image',
  adminOrUserAuth,
  uploadSingleImageMiddleware,
  handleMulterError,
  uploadSingleImage
);

// Upload multiple images
// POST /api/upload/images
// @multipart files: images[]
// @query folder: optional folder name
router.post('/images',
  adminOrUserAuth,
  uploadMultipleImagesMiddleware,
  handleMulterError,
  uploadImages
);

// Upload profile photo
// POST /api/upload/profile-photo
// @multipart file: photo
router.post('/profile-photo',
  protectedRoutes,
  uploadProfilePhotoMiddleware,
  handleMulterError,
  uploadProfilePhoto
);

// Upload product images
// POST /api/upload/product-images
// @multipart files: images[]
router.post('/product-images',
  adminOrUserAuth,
  uploadMultipleImagesMiddleware,
  handleMulterError,
  uploadProductImages
);

// Upload course media (thumbnail/banner)
// POST /api/upload/course-media
// @multipart file: image
// @query type: thumbnail or banner
router.post('/course-media',
  adminAuth,
  requirePermission('manage_courses'),
  uploadSingleImageMiddleware,
  handleMulterError,
  uploadCourseMedia
);

// ========================================
// Video Upload Routes (Protected or Admin)
// ========================================

// Create a presigned URL for direct-to-R2 upload (avoids proxying large files)
// POST /api/upload/video/presign
// @body filename, contentType
// @query folder: optional folder name
router.post('/video/presign',
  adminAuth,
  requirePermission('manage_courses'),
  getVideoPresignedUrl
);

// Upload video
// POST /api/upload/video
// @multipart file: video
// @query folder: optional folder name
router.post('/video',
  adminAuth,
  requirePermission('manage_courses'),
  uploadSingleVideo,
  handleMulterError,
  uploadVideoFile
);

// Upload audio (course lessons / podcasts)
router.post('/audio',
  adminAuth,
  requirePermission('manage_courses', 'manage_content'),
  uploadSingleAudio,
  handleMulterError,
  uploadAudioFile
);

// Upload PDF (for course materials)
router.post('/pdf',
  adminAuth,
  requirePermission('manage_courses'),
  uploadSinglePdf,
  handleMulterError,
  uploadPdfFile
);

// Upload a certificate background image or PDF
router.post('/certificate-template',
  adminAuth,
  requirePermission('manage_users'),
  uploadCertificateTemplateBackground,
  handleMulterError,
  uploadCertificateTemplate
);

// ========================================
// Delete Routes (Protected or Admin)
// ========================================

// Delete uploaded file
// DELETE /api/upload/delete
// @body publicId: Cloudinary public ID
// @body resourceType: image or video
router.delete('/delete',
  adminAuth,
  deleteUploadedFile
);

export default router;
