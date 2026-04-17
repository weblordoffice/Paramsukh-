import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Configure multer for memory storage (we'll upload to Cloudinary from memory)
const storage = multer.memoryStorage();

// For large videos, store on disk temporarily to avoid buffering 1GB in RAM
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadDir = path.join(process.cwd(), 'tmp', 'uploads');
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (e) {
      cb(e, undefined);
    }
  },
  filename: (req, file, cb) => {
    const safe = `${Date.now()}_${(file.originalname || 'video').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, safe);
  }
});

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), false);
  }
};

// File filter for videos
const videoFilter = (req, file, cb) => {
  const allowedMimes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only MP4, MPEG, MOV, AVI and WebM are allowed.'), false);
  }
};

// File filter for PDFs
const pdfFilter = (req, file, cb) => {
  const allowedMimes = ['application/pdf'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF is allowed.'), false);
  }
};

// File filter for spreadsheets
const spreadsheetFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'text/plain'
  ];

  const extension = String(file?.originalname || '').split('.').pop()?.toLowerCase();
  const allowedExtensions = ['xlsx', 'xls', 'csv'];
  const isMimeAllowed = allowedMimes.includes(file.mimetype);
  const isExtensionAllowed = allowedExtensions.includes(extension || '');

  if (isMimeAllowed || isExtensionAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only XLSX, XLS and CSV are allowed.'), false);
  }
};

// File filter for both images and videos
const mediaFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type.'), false);
  }
};

// Single image upload (max 5MB)
export const uploadSingleImage = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
}).single('image');

// Multiple images upload (max 10 images, 5MB each)
export const uploadMultipleImages = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10 // Maximum 10 files
  }
}).array('images', 10);

// Single video upload (max 1GB)
export const uploadSingleVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB
  }
}).single('video');

// Profile photo upload (max 2MB)
export const uploadProfilePhoto = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
}).single('photo');

// Single PDF upload (max 50MB)
export const uploadSinglePdf = multer({
  storage: storage,
  fileFilter: pdfFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
}).single('pdf');

// Single spreadsheet upload (max 10MB)
export const uploadSingleSpreadsheet = multer({
  storage: storage,
  fileFilter: spreadsheetFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
}).single('file');

// Mixed media upload (images and videos)
export const uploadMixedMedia = multer({
  storage: storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB
    files: 10
  }
}).array('media', 10);

// Error handler middleware for multer errors
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum file size exceeded.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum file count exceeded.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field in form data.'
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message
    });
  } else if (err) {
    // Other errors (like file type validation)
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  next();
};

export default {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleVideo,
  uploadProfilePhoto,
  uploadSinglePdf,
  uploadSingleSpreadsheet,
  uploadMixedMedia,
  handleMulterError
};
