import express from 'express';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import {
  uploadSingleImage as uploadSingleImageMiddleware,
  uploadMultipleImages as uploadMultipleImagesMiddleware,
  uploadSingleVideo,
  uploadSinglePdf,
  uploadProfilePhoto as uploadProfilePhotoMiddleware,
  handleMulterError
} from '../../middleware/uploadMiddleware.js';
import {
  uploadSingleImage,
  uploadImages,
  uploadProfilePhoto,
  uploadVideoFile,
  uploadPdfFile,
  uploadProductImages,
  uploadCourseMedia,
  deleteUploadedFile,
  getUploadStatus
} from '../../controller/upload/upload.controller.js';

const router = express.Router();

// Helper middleware to allow either Admin API Key or User Token
const adminOrUserAuth = async (req, res, next) => {
  const apiKey = req.headers['x-admin-api-key'];
  const adminApiKey = process.env.ADMIN_API_KEY || 'dev-admin-key-123';

  if (apiKey && apiKey === adminApiKey) {
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
  uploadSingleImageMiddleware,
  handleMulterError,
  uploadCourseMedia
);

// ========================================
// Video Upload Routes (Protected or Admin)
// ========================================

// Upload video
// POST /api/upload/video
// @multipart file: video
// @query folder: optional folder name
router.post('/video',
  adminOrUserAuth,
  uploadSingleVideo,
  handleMulterError,
  uploadVideoFile
);

// Upload PDF (for course materials)
// POST /api/upload/pdf
// @multipart file: PDF file (max 50MB)
router.post('/pdf',
  adminOrUserAuth,
  uploadSinglePdf,
  handleMulterError,
  uploadPdfFile
);

// ========================================
// Delete Routes (Protected or Admin)
// ========================================

// Delete uploaded file
// DELETE /api/upload/delete
// @body publicId: Cloudinary public ID
// @body resourceType: image or video
router.delete('/delete',
  adminOrUserAuth,
  deleteUploadedFile
);

export default router;
