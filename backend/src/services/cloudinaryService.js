import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import fs from 'fs';

// Test mode flag - set to true to use without real Cloudinary credentials
const TEST_MODE = !process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'test';

// Initialize Cloudinary only if credentials are available
if (!TEST_MODE) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    console.log('✅ Cloudinary initialized successfully');
  } catch (error) {
    console.error('❌ Cloudinary initialization failed:', error.message);
  }
}

/**
 * Generate mock Cloudinary URL for test mode
 */
const generateMockUrl = (filename, folder, resourceType = 'image') => {
  const timestamp = Date.now();
  const mockId = `${folder}/${filename}_${timestamp}`;
  return `https://res.cloudinary.com/test-cloud/image/upload/v${timestamp}/${mockId}`;
};

/**
 * Upload image to Cloudinary
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {String} folder - Cloudinary folder name
 * @param {String} filename - Original filename
 * @returns {Promise<Object>} Upload result with URL
 */
export const uploadImage = async (fileBuffer, folder = 'uploads', filename = 'image') => {
  try {
    // Test mode - return mock URL
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Generating mock image URL');
      const mockUrl = generateMockUrl(filename, folder, 'image');
      return {
        success: true,
        url: mockUrl,
        publicId: `${folder}/${filename}_${Date.now()}`,
        resourceType: 'image',
        format: 'jpg',
        width: 1920,
        height: 1080,
        bytes: fileBuffer.length,
        testMode: true
      };
    }

    // Real Cloudinary upload
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: 'image',
          format: 'jpg',
          transformation: [
            { width: 2000, height: 2000, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Image uploaded to Cloudinary:', result.public_id);
            resolve({
              success: true,
              url: result.secure_url,
              publicId: result.public_id,
              resourceType: result.resource_type,
              format: result.format,
              width: result.width,
              height: result.height,
              bytes: result.bytes,
              testMode: false
            });
          }
        }
      );

      // Convert buffer to stream and pipe to Cloudinary
      const readableStream = Readable.from(fileBuffer);
      readableStream.pipe(uploadStream);
    });

  } catch (error) {
    console.error('❌ Upload image error:', error);
    throw new Error('Failed to upload image: ' + error.message);
  }
};

/**
 * Upload video to Cloudinary
 * @param {Buffer} fileBuffer - Video file buffer
 * @param {String} folder - Cloudinary folder name
 * @param {String} filename - Original filename
 * @returns {Promise<Object>} Upload result with URL
 */
export const uploadVideo = async (fileInput, folder = 'videos', filename = 'video') => {
  try {
    // Test mode - return mock URL
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Generating mock video URL');
      const mockUrl = generateMockUrl(filename, folder, 'video');
      return {
        success: true,
        url: mockUrl,
        publicId: `${folder}/${filename}_${Date.now()}`,
        resourceType: 'video',
        format: 'mp4',
        duration: 120.5,
        width: 1920,
        height: 1080,
        bytes: Buffer.isBuffer(fileInput) ? fileInput.length : 0,
        testMode: true
      };
    }

    // Prefer Cloudinary's chunked upload for large files (disk path input).
    // upload_large returns a stream when no callback is passed; use callback form to get the result.
    if (typeof fileInput === 'string' && fileInput) {
      if (!fs.existsSync(fileInput)) {
        throw new Error('Upload temp file missing');
      }
      return new Promise((resolve, reject) => {
        // NOTE: cloudinary.v2 uploader signature is (path, options, callback)
        cloudinary.uploader.upload_large(fileInput, {
          folder,
          resource_type: 'video',
          chunk_size: 6_000_000,
          timeout: 10 * 60 * 1000, // 10 minutes
          eager_async: true,
        }, (err, result) => {
          if (err) {
            console.error('❌ Cloudinary upload_large error:', err);
            return reject(err);
          }
          const url = result?.secure_url || result?.url;
          if (!url) {
            console.error('❌ Cloudinary did not return a URL. Result keys:', result ? Object.keys(result) : []);
            return reject(new Error('Cloudinary video upload did not return a URL'));
          }
          console.log('✅ Video uploaded to Cloudinary:', result.public_id);
          resolve({
            success: true,
            url,
            publicId: result.public_id,
            resourceType: result.resource_type,
            format: result.format,
            duration: result.duration,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            testMode: false
          });
        });
      });
    }

    // Buffer fallback (small videos only): stream upload with higher timeout
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: 'video',
          timeout: 10 * 60 * 1000, // 10 minutes
          eager_async: true
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary video upload error:', error);
            reject(error);
          } else {
            const url = result?.secure_url || result?.url;
            if (!url) {
              console.error('❌ Cloudinary stream upload did not return a URL');
              return reject(new Error('Cloudinary video upload did not return a URL'));
            }
            console.log('✅ Video uploaded to Cloudinary:', result.public_id);
            resolve({
              success: true,
              url,
              publicId: result.public_id,
              resourceType: result.resource_type,
              format: result.format,
              duration: result.duration,
              width: result.width,
              height: result.height,
              bytes: result.bytes,
              testMode: false
            });
          }
        }
      );

      const readableStream = Readable.from(fileInput);
      readableStream.pipe(uploadStream);
    });

  } catch (error) {
    console.error('❌ Upload video error:', error);
    throw new Error('Failed to upload video: ' + error.message);
  }
};

/**
 * Upload multiple images
 * @param {Array<Buffer>} fileBuffers - Array of image buffers
 * @param {String} folder - Cloudinary folder name
 * @returns {Promise<Array>} Array of upload results
 */
export const uploadMultipleImages = async (fileBuffers, folder = 'uploads') => {
  try {
    const uploadPromises = fileBuffers.map((buffer, index) => 
      uploadImage(buffer, folder, `image_${index}`)
    );
    
    const results = await Promise.all(uploadPromises);
    console.log(`✅ Uploaded ${results.length} images`);
    return results;

  } catch (error) {
    console.error('❌ Upload multiple images error:', error);
    throw new Error('Failed to upload images: ' + error.message);
  }
};

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Cloudinary public ID
 * @param {String} resourceType - Resource type (image/video)
 * @returns {Promise<Object>} Deletion result
 */
export const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    // Test mode - mock deletion
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Mock file deletion');
      return {
        success: true,
        result: 'ok',
        message: 'File deleted (test mode)',
        testMode: true
      };
    }

    // Real Cloudinary deletion
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });

    console.log('✅ File deleted from Cloudinary:', publicId);
    return {
      success: true,
      result: result.result,
      testMode: false
    };

  } catch (error) {
    console.error('❌ Delete file error:', error);
    throw new Error('Failed to delete file: ' + error.message);
  }
};

/**
 * Generate thumbnail from video
 * @param {String} videoPublicId - Video public ID
 * @returns {String} Thumbnail URL
 */
export const generateVideoThumbnail = (videoPublicId) => {
  if (TEST_MODE) {
    return generateMockUrl('thumbnail', 'videos', 'image');
  }

  return cloudinary.url(videoPublicId, {
    resource_type: 'video',
    format: 'jpg',
    transformation: [
      { width: 640, height: 360, crop: 'fill' },
      { quality: 'auto' }
    ]
  });
};

/**
 * Get optimized image URL
 * @param {String} publicId - Image public ID
 * @param {Object} options - Transformation options
 * @returns {String} Optimized image URL
 */
export const getOptimizedImageUrl = (publicId, options = {}) => {
  if (TEST_MODE) {
    return generateMockUrl('optimized', 'images', 'image');
  }

  const {
    width = 800,
    height = 600,
    crop = 'fill',
    quality = 'auto',
    format = 'auto'
  } = options;

  return cloudinary.url(publicId, {
    transformation: [
      { width, height, crop },
      { quality, fetch_format: format }
    ]
  });
};

/**
 * Upload raw file (e.g. PDF) to Cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} folder - Cloudinary folder name
 * @param {String} filename - Original filename
 * @returns {Promise<Object>} Upload result with URL
 */
export const uploadRawFile = async (fileBuffer, folder = 'pdfs', filename = 'document') => {
  try {
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Generating mock raw/PDF URL');
      const mockUrl = generateMockUrl(filename.replace(/\.[^.]+$/, ''), folder, 'raw');
      return {
        success: true,
        url: mockUrl,
        publicId: `${folder}/${filename}_${Date.now()}`,
        resourceType: 'raw',
        bytes: fileBuffer.length,
        testMode: true
      };
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'raw'
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary raw upload error:', error);
            reject(error);
          } else {
            console.log('✅ PDF/raw file uploaded to Cloudinary:', result.public_id);
            resolve({
              success: true,
              url: result.secure_url,
              publicId: result.public_id,
              resourceType: result.resource_type,
              bytes: result.bytes,
              testMode: false
            });
          }
        }
      );
      const readableStream = Readable.from(fileBuffer);
      readableStream.pipe(uploadStream);
    });
  } catch (error) {
    console.error('❌ Upload raw file error:', error);
    throw new Error('Failed to upload file: ' + error.message);
  }
};

// Export test mode status
export const isTestMode = () => TEST_MODE;

export default {
  uploadImage,
  uploadVideo,
  uploadMultipleImages,
  uploadRawFile,
  deleteFile,
  generateVideoThumbnail,
  getOptimizedImageUrl,
  isTestMode
};
