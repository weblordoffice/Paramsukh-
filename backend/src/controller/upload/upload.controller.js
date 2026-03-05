import { 
  uploadImage, 
  uploadVideo, 
  uploadMultipleImages,
  uploadRawFile,
  deleteFile,
  isTestMode 
} from '../../services/cloudinaryService.js';
import fs from 'fs/promises';

/**
 * Upload single image
 * POST /api/upload/image
 * @multipart file: image file
 * @query folder: optional folder name
 */
export const uploadSingleImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const folder = req.query.folder || 'general';
    const filename = req.file.originalname;

    // Upload to Cloudinary (or mock in test mode)
    const result = await uploadImage(req.file.buffer, folder, filename);

    console.log(`✅ Image uploaded: ${result.url}`);

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: result.url,
        publicId: result.publicId,
        width: result.width,
        height: result.height,
        size: result.bytes,
        format: result.format,
        testMode: result.testMode || false
      }
    });

  } catch (error) {
    console.error('❌ Upload image error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
};

/**
 * Upload multiple images
 * POST /api/upload/images
 * @multipart files: array of image files
 * @query folder: optional folder name
 */
export const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const folder = req.query.folder || 'general';
    const fileBuffers = req.files.map(file => file.buffer);

    // Upload all images
    const results = await uploadMultipleImages(fileBuffers, folder);

    console.log(`✅ ${results.length} images uploaded`);

    return res.status(200).json({
      success: true,
      message: `${results.length} images uploaded successfully`,
      data: {
        images: results.map(result => ({
          url: result.url,
          publicId: result.publicId,
          width: result.width,
          height: result.height,
          size: result.bytes,
          format: result.format
        })),
        count: results.length,
        testMode: results[0]?.testMode || false
      }
    });

  } catch (error) {
    console.error('❌ Upload images error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: error.message
    });
  }
};

/**
 * Upload profile photo
 * POST /api/upload/profile-photo
 * @multipart file: image file
 */
export const uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo uploaded'
      });
    }

    const folder = 'profile-photos';
    const filename = `user_${userId}_${Date.now()}`;

    // Upload to Cloudinary
    const result = await uploadImage(req.file.buffer, folder, filename);

    console.log(`✅ Profile photo uploaded for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        photoURL: result.url,
        publicId: result.publicId,
        testMode: result.testMode || false
      }
    });

  } catch (error) {
    console.error('❌ Upload profile photo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo',
      error: error.message
    });
  }
};

/**
 * Upload video
 * POST /api/upload/video
 * @multipart file: video file
 * @query folder: optional folder name
 */
export const uploadVideoFile = async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video uploaded'
      });
    }

    const folder = req.query.folder || 'videos';
    const filename = req.file.originalname;

    // Upload to Cloudinary (use tmp file path for large uploads; buffer only as fallback)
    const result = await uploadVideo(tmpPath || req.file.buffer, folder, filename);

    const url = result?.url;
    if (!url) {
      console.error('❌ Upload succeeded but no URL in result:', result);
      return res.status(500).json({
        success: false,
        message: 'Video upload did not return a URL',
        error: 'No URL in upload result'
      });
    }

    console.log(`✅ Video uploaded: ${url}`);

    return res.status(200).json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        url,
        publicId: result.publicId,
        duration: result.duration,
        width: result.width,
        height: result.height,
        size: result.bytes,
        format: result.format,
        testMode: result.testMode || false
      }
    });

  } catch (error) {
    console.error('❌ Upload video error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload video',
      error: error.message
    });
  } finally {
    // Cleanup tmp file if we used disk storage
    if (tmpPath) {
      try { await fs.unlink(tmpPath); } catch {}
    }
  }
};

/**
 * Upload PDF file
 * POST /api/upload/pdf
 * @multipart file: PDF file
 * @query folder: optional folder name (default: pdfs)
 */
export const uploadPdfFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded'
      });
    }

    const folder = req.query.folder || 'pdfs';
    const filename = req.file.originalname || 'document.pdf';

    const result = await uploadRawFile(req.file.buffer, folder, filename);

    return res.status(200).json({
      success: true,
      message: 'PDF uploaded successfully',
      data: {
        url: result.url,
        publicId: result.publicId,
        size: result.bytes,
        testMode: result.testMode || false
      }
    });
  } catch (error) {
    console.error('❌ Upload PDF error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload PDF',
      error: error.message
    });
  }
};

/**
 * Upload product images
 * POST /api/upload/product-images
 * @multipart files: array of product image files
 */
export const uploadProductImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const folder = 'products';
    const fileBuffers = req.files.map(file => file.buffer);

    const results = await uploadMultipleImages(fileBuffers, folder);

    return res.status(200).json({
      success: true,
      message: 'Product images uploaded successfully',
      data: {
        images: results.map((result, index) => ({
          url: result.url,
          publicId: result.publicId,
          isPrimary: index === 0, // First image is primary
          alt: `Product image ${index + 1}`
        })),
        testMode: results[0]?.testMode || false
      }
    });

  } catch (error) {
    console.error('❌ Upload product images error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload product images',
      error: error.message
    });
  }
};

/**
 * Upload course thumbnail/banner
 * POST /api/upload/course-media
 * @multipart file: image file
 * @query type: thumbnail or banner
 */
export const uploadCourseMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const type = req.query.type || 'thumbnail'; // thumbnail or banner
    const folder = `courses/${type}s`;
    const filename = `course_${type}_${Date.now()}`;

    const result = await uploadImage(req.file.buffer, folder, filename);

    return res.status(200).json({
      success: true,
      message: `Course ${type} uploaded successfully`,
      data: {
        url: result.url,
        publicId: result.publicId,
        type: type,
        testMode: result.testMode || false
      }
    });

  } catch (error) {
    console.error('❌ Upload course media error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload course media',
      error: error.message
    });
  }
};

/**
 * Delete uploaded file
 * DELETE /api/upload/delete
 * @body publicId: Cloudinary public ID
 * @body resourceType: image or video
 */
export const deleteUploadedFile = async (req, res) => {
  try {
    const { publicId, resourceType = 'image' } = req.body;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    const result = await deleteFile(publicId, resourceType);

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Delete file error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
};

/**
 * Get upload status (test mode or production)
 * GET /api/upload/status
 */
export const getUploadStatus = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        testMode: isTestMode(),
        message: isTestMode() 
          ? 'Running in TEST MODE - uploads are mocked' 
          : 'Running in PRODUCTION MODE - uploads go to Cloudinary',
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'test-cloud'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get upload status'
    });
  }
};

export default {
  uploadSingleImage,
  uploadImages,
  uploadProfilePhoto,
  uploadVideoFile,
  uploadProductImages,
  uploadCourseMedia,
  deleteUploadedFile,
  getUploadStatus
};
