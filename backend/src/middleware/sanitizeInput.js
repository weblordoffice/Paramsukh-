import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Initialize DOMPurify with JSDOM for server-side sanitization
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Sanitize HTML content to prevent XSS attacks
 * Allows only safe HTML tags (b, i, em, strong, a, p, br, ul, ol, li)
 */
export const sanitizeHtml = (html) => {
  if (!html || typeof html !== 'string') return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
  });
};

/**
 * Sanitize plain text content
 * Escapes HTML entities and removes potentially dangerous characters
 */
export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return '';

  // Remove null bytes and control characters except newlines and tabs
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
};

/**
 * Validate and sanitize URL
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';

  try {
    const parsedUrl = new URL(url);
    
    // Only allow http, https, and data URLs
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return '';
    }

    return parsedUrl.toString();
  } catch {
    return '';
  }
};

/**
 * Middleware to sanitize post content
 */
export const sanitizePostContent = (req, res, next) => {
  if (req.body.content) {
    req.body.content = sanitizeText(req.body.content);
    
    // Validate content length after sanitization
    if (req.body.content.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Post content cannot be empty'
      });
    }

    if (req.body.content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Post content must be less than 5000 characters'
      });
    }
  }

  if (req.body.images && Array.isArray(req.body.images)) {
    req.body.images = req.body.images
      .map(url => sanitizeUrl(url))
      .filter(url => url.length > 0);
  }

  if (req.body.tags && Array.isArray(req.body.tags)) {
    req.body.tags = req.body.tags
      .map(tag => sanitizeText(tag))
      .filter(tag => tag.length > 0)
      .slice(0, 10); // Max 10 tags
  }

  next();
};

/**
 * Middleware to sanitize comment content
 */
export const sanitizeCommentContent = (req, res, next) => {
  if (req.body.content) {
    req.body.content = sanitizeText(req.body.content);
    
    if (req.body.content.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content cannot be empty'
      });
    }

    if (req.body.content.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Comment must be less than 1000 characters'
      });
    }
  }

  next();
};
