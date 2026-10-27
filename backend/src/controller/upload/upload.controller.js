import {
  uploadImage,
  uploadMultipleImages,
  uploadRawFile,
  deleteFile,
  isTestMode
} from '../../services/cloudinaryService.js';
import { PDFDocument } from 'pdf-lib';
import { uploadVideo, deleteVideo, extractKeyFromUrl, getPresignedUploadUrl } from '../../services/r2Service.js';
import crypto from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_UPLOAD_ROOT = path.join(__dirname, '..', '..', '..', 'public', 'uploads');
const LOCAL_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const sanitizeUploadFolder = (folder) => {
  const parts = String(folder || 'general')
    .split('/')
    .map((part) => part.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean);
  return parts.length > 0 ? parts.join('/') : 'general';
};

const saveLocalImage = async (file, folder) => {
  const safeFolder = sanitizeUploadFolder(folder);
  const originalExtension = path.extname(file.originalname || '').toLowerCase();
  const extension = LOCAL_IMAGE_EXTENSIONS.has(originalExtension) ? originalExtension : '.jpg';
  const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${extension}`;
  const directory = path.join(LOCAL_UPLOAD_ROOT, safeFolder);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), file.buffer);

  return {
    success: true,
    url: `/uploads/${safeFolder}/${filename}`,
    publicId: `local:${safeFolder}/${filename}`,
    bytes: file.size,
    storage: 'local',
    testMode: false,
  };
};

const ALLOWED_VIDEO_MIME = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
];

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
    const useLocalStorage = String(req.query.storage || '').toLowerCase() === 'local';

    const result = useLocalStorage
      ? await saveLocalImage(req.file, folder)
      : await uploadImage(req.file.buffer, folder, filename);

    console.log(`Image uploaded (${result.storage || 'cloudinary'}): ${result.url}`);

    return res.status(200).json({
      success: true,
      message: useLocalStorage ? 'Image saved locally' : 'Image uploaded successfully',
      data: {
        url: result.url,
        publicId: result.publicId,
        width: result.width,
        height: result.height,
        size: result.bytes,
        format: result.format,
        storage: result.storage || 'cloudinary',
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
 * Upload video to R2
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

    const result = await uploadVideo(tmpPath || req.file.buffer, folder, filename);

    const url = result?.url;
    if (!url) {
      console.error(' Upload succeeded but no URL in result:', result);
      return res.status(500).json({
        success: false,
        message: 'Video upload did not return a URL',
        error: 'No URL in upload result'
      });
    }

    console.log(` Video uploaded: ${url}`);

    return res.status(200).json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        url,
        key: result.key,
        size: result.bytes,
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
    if (tmpPath) {
      try { await fs.unlink(tmpPath); } catch {}
    }
  }
};

/**
 * Upload audio file (R2)
 * POST /api/upload/audio
 * @multipart file: audio file
 * @query folder: optional folder name
 */
export const uploadAudioFile = async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio uploaded'
      });
    }

    const folder = req.query.folder || 'podcasts/audio';
    const filename = req.file.originalname;
    const result = await uploadVideo(tmpPath || req.file.buffer, folder, filename);
    const url = result?.url;

    if (!url) {
      return res.status(500).json({
        success: false,
        message: 'Audio upload did not return a URL',
        error: 'No URL in upload result'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Audio uploaded successfully',
      data: {
        url,
        key: result.key,
        size: result.bytes,
        testMode: result.testMode || false
      }
    });
  } catch (error) {
    console.error('❌ Upload audio error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload audio',
      error: error.message
    });
  } finally {
    if (tmpPath) {
      try { await fs.unlink(tmpPath); } catch {}
    }
  }
};

/**
 * Upload PDF file (Cloudinary)
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
 * Upload product images (Cloudinary)
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
          isPrimary: index === 0,
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
 * Upload course thumbnail/banner (Cloudinary)
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

    const type = req.query.type || 'thumbnail';
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
 * @body publicId: Cloudinary public ID (images/PDFs)
 * @body key: R2 key (videos)
 * @body resourceType: image or video
 */
export const deleteUploadedFile = async (req, res) => {
  try {
    const { publicId, key, resourceType = 'image' } = req.body;

    if (resourceType === 'video') {
      const deleteKey = key || extractKeyFromUrl(req.body.url) || publicId;
      if (!deleteKey) {
        return res.status(400).json({ success: false, message: 'Video key or URL is required' });
      }
      const result = await deleteVideo(deleteKey);
      return res.status(200).json({
        success: true,
        message: 'Video deleted successfully',
        data: result
      });
    }

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
 * Get upload status
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
          : 'Running in PRODUCTION MODE - images → Cloudinary, videos → Cloudflare R2',
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

/**
 * Create a presigned R2 PUT URL so the client uploads the video directly to R2.
 * POST /api/upload/video/presign
 * @body filename, contentType
 * @query folder: optional folder name
 */
export const getVideoPresignedUrl = async (req, res) => {
  try {
    const { filename, contentType } = req.body || {};

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ success: false, message: 'filename is required' });
    }

    const ct = String(contentType || '').trim();
    if (ct && !ALLOWED_VIDEO_MIME.includes(ct)) {
      return res.status(400).json({ success: false, message: 'Unsupported video type' });
    }

    const folder = String(req.query.folder || 'videos');
    const allowedFolders = new Set(['videos', 'course-videos', 'courses', 'events', 'event-media']);
    if (!allowedFolders.has(folder)) {
      return res.status(400).json({ success: false, message: 'Invalid upload folder' });
    }

    const result = await getPresignedUploadUrl({
      filename,
      contentType: ct || undefined,
      folder,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.code === 'R2_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        code: 'R2_NOT_CONFIGURED',
        message: 'Direct upload is not available',
      });
    }
    console.error('❌ Presign video error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create upload URL',
      error: error.message,
    });
  }
};

/**
 * Upload a certificate background (PNG/JPG/PDF).
 * POST /api/upload/certificate-template
 */
export const uploadCertificateTemplate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const isPdf = req.file.mimetype === 'application/pdf';
    const folder = 'certificates/templates';
    let pageWidth = 842;
    let pageHeight = 595;
    let pageCount = 1;
    let upload;

    if (isPdf) {
      let source;
      try {
        source = await PDFDocument.load(req.file.buffer);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'This PDF could not be read. Upload an unlocked PDF template.',
        });
      }

      pageCount = source.getPageCount();
      if (pageCount < 1) {
        return res.status(400).json({ success: false, message: 'The PDF has no pages' });
      }
      const firstPage = source.getPage(0);
      pageWidth = firstPage.getWidth();
      pageHeight = firstPage.getHeight();
      upload = await uploadRawFile(
        req.file.buffer,
        folder,
        req.file.originalname || 'certificate-template.pdf'
      );
    } else {
      const imageDoc = await PDFDocument.create();
      const image = req.file.mimetype === 'image/png'
        ? await imageDoc.embedPng(req.file.buffer)
        : await imageDoc.embedJpg(req.file.buffer);
      pageWidth = image.width;
      pageHeight = image.height;
      upload = await uploadImage(
        req.file.buffer,
        folder,
        req.file.originalname || 'certificate-template.png'
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        backgroundType: isPdf ? 'pdf' : 'image',
        url: upload.url,
        publicId: upload.publicId,
        pageWidth,
        pageHeight,
        pageCount,
        filename: req.file.originalname,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error('Certificate template upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload certificate template',
      error: error.message,
    });
  }
};

export default {
  uploadSingleImage,
  uploadImages,
  uploadProfilePhoto,
  uploadVideoFile,
  uploadAudioFile,
  getVideoPresignedUrl,
  uploadProductImages,
  uploadCourseMedia,
  deleteUploadedFile,
  getUploadStatus,
  uploadCertificateTemplate
};
