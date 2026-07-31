import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'fs';
import path from 'path';

const isConfigured = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME
);

const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
const R2_BUCKET = process.env.R2_BUCKET_NAME || '';

let s3Client = null;

if (isConfigured) {
  s3Client = new S3Client({
    region: process.env.R2_REGION || 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  console.log(' Cloudflare R2 initialized');
} else {
  console.warn(' Cloudflare R2 not configured — video uploads will use local storage fallback');
}

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska',
};

const guessContentType = (filename, fallback = 'application/octet-stream') => {
  if (!filename) return fallback;
  const ext = path.extname(filename).replace('.', '').toLowerCase();
  return MIME_BY_EXT[ext] || fallback;
};

const TRANSIENT_CODES = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_ERRS = new Set([
  'RequestTimeout', 'RequestThrottled', 'ServiceUnavailable',
  'SlowDown', 'InternalError', 'NetworkError', 'NetworkingError',
  'TimeoutError', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE',
]);

const isTransient = (err) => {
  const status = err?.$metadata?.httpStatusCode;
  if (status && TRANSIENT_CODES.has(status)) return true;
  const code = err?.Code || err?.name;
  if (code && TRANSIENT_ERRS.has(code)) return true;
  if (err?.message && /timeout|network|socket|reset|econnrefused|econnreset/i.test(err.message)) return true;
  return false;
};

const withRetry = async (fn, { maxRetries = 3, baseDelay = 1000 } = {}) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries || !isTransient(err)) throw err;
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(`  R2 retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms: ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};

const generateKey = (folder, filename) => {
  const ext = path.extname(filename) || '.mp4';
  const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const folderPath = folder ? `${folder.replace(/\/$/, '')}/` : '';
  return `${folderPath}${base}_${timestamp}_${random}${ext}`;
};

const buildPublicUrl = (key) => {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  return `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`;
};

/**
 * Upload video to Cloudflare R2
 * Supports files up to 2GB via multipart upload
 */
export const uploadVideo = async (fileInput, folder = 'videos', filename = 'video.mp4', opts = {}) => {
  const { contentType, cacheControl, contentDisposition } = opts;
  const key = generateKey(folder, filename);

  if (!isConfigured) {
    console.log(' R2 not configured — storing video locally');
    const localDir = path.join(process.cwd(), 'public', 'uploads', folder);
    fs.mkdirSync(localDir, { recursive: true });
    const localPath = path.join(localDir, path.basename(key));

    if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
      fs.copyFileSync(fileInput, localPath);
    }

    return {
      success: true,
      url: `/uploads/${folder}/${path.basename(key)}`,
      key,
      bytes: typeof fileInput === 'string' ? fs.statSync(fileInput).size : (Buffer.isBuffer(fileInput) ? fileInput.length : 0),
      testMode: true,
    };
  }

  const ct = contentType || guessContentType(filename, 'video/mp4');
  const cc = cacheControl || 'public, max-age=31536000, immutable';

  return withRetry(async () => {
    let body;
    let bytes = 0;

    if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
      const stats = fs.statSync(fileInput);
      bytes = stats.size;

      if (bytes > 100 * 1024 * 1024) {
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: R2_BUCKET,
            Key: key,
            Body: fs.createReadStream(fileInput),
            ContentType: ct,
            CacheControl: cc,
            ContentDisposition: contentDisposition || 'inline',
          },
          queueSize: 4,
          partSize: 20 * 1024 * 1024,
        });

        await upload.done();
        console.log(` Video uploaded to R2 (multipart): ${key}`);
        return { success: true, url: buildPublicUrl(key), key, bytes };
      }

      body = fs.createReadStream(fileInput);
    } else if (Buffer.isBuffer(fileInput)) {
      body = fileInput;
      bytes = fileInput.length;
    } else if (fileInput && typeof fileInput.path === 'string' && fs.existsSync(fileInput.path)) {
      const stats = fs.statSync(fileInput.path);
      bytes = stats.size;
      body = fs.createReadStream(fileInput.path);
    } else {
      throw new Error('Invalid file input: expected file path string or Buffer');
    }

    await s3Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: ct,
      CacheControl: cc,
      ContentDisposition: contentDisposition || 'inline',
    }));

    console.log(` Video uploaded to R2: ${key}`);
    return { success: true, url: buildPublicUrl(key), key, bytes };
  });
};

/**
 * Delete video from Cloudflare R2
 */
export const deleteVideo = async (key) => {
  if (!key) return { success: false, message: 'No key provided' };

  if (!isConfigured) {
    const localPath = path.join(process.cwd(), 'public', key);
    try { fs.unlinkSync(localPath); } catch {}
    return { success: true, message: 'Deleted locally' };
  }

  await s3Client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  }));

  console.log(` Video deleted from R2: ${key}`);
  return { success: true };
};

/**
 * Check if a video exists in R2
 */
export const videoExists = async (key) => {
  if (!key || !isConfigured) return false;
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
};

/**
 * Extract R2 key from a public URL
 */
export const extractKeyFromUrl = (url) => {
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return null;
  }
};

/**
 * Generate a public download URL for a video
 */
export const getVideoUrl = (key) => {
  if (!key) return null;
  return buildPublicUrl(key);
};

export default {
  uploadVideo,
  deleteVideo,
  videoExists,
  extractKeyFromUrl,
  getVideoUrl,
};
