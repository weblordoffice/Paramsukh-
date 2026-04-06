// Rate Limiting Middleware
import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter - 100 requests per 15 minutes
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Strict rate limiter for authentication - 5 requests per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Upload rate limiter - 20 uploads per hour
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: {
    success: false,
    message: 'Too many upload requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Payment rate limiter - 10 payment attempts per hour
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many payment attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * OTP rate limiter - 3 OTP requests per 10 minutes per phone/IP (production)
 * or 10 requests per 10 minutes (development)
 * Uses phone number from request body or falls back to IP
 */
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: process.env.NODE_ENV === 'production' ? 3 : 10, // More lenient in dev
  message: {
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Too many OTP requests. Please try again after 10 minutes.'
      : 'Rate limit reached. Please wait a moment before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use phone number if available, otherwise fall back to IP
  keyGenerator: (req) => {
    // Use phone number from request body for more accurate rate limiting
    const phone = req.body?.phone;
    if (phone) {
      return `otp:${phone}`;
    }
    // Fallback to IP address
    return `otp:${req.ip}`;
  },
  // Log rate limit hits in development
  handler: (req, res) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`⚠️  Rate limit hit for: ${req.body?.phone || req.ip}`);
    }
    res.status(429).json({
      success: false,
      message: process.env.NODE_ENV === 'production' 
        ? 'Too many OTP requests. Please try again after 10 minutes.'
        : 'Rate limit reached. Please wait a moment before trying again.'
    });
  }
});

/**
 * Review/Comment rate limiter - 30 per hour
 */
export const contentCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: {
    success: false,
    message: 'Too many posts/comments. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Community post creation limiter - 10 posts per hour per user
 */
export const communityPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 posts per hour
  message: {
    success: false,
    message: 'You have exceeded the post creation limit. Please wait before creating more posts.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID instead of IP
    return `community:post:${req.user?._id || req.ip}`;
  }
});

/**
 * Community comment limiter - 20 comments per hour per user
 */
export const communityCommentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Max 20 comments per hour
  message: {
    success: false,
    message: 'You have exceeded the comment limit. Please wait before adding more comments.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `community:comment:${req.user?._id || req.ip}`;
  }
});

/**
 * Community like limiter - 50 likes per 10 minutes per user
 */
export const communityLikeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50,
  message: {
    success: false,
    message: 'Too many likes. Please take a break.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `community:like:${req.user?._id || req.ip}`;
  }
});

/**
 * Booking rate limiter - 5 bookings per hour per user
 */
export const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    message: 'Too many booking attempts. Please wait before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `booking:${req.user?._id || req.ip}`;
  }
});

export default {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  paymentLimiter,
  otpLimiter,
  contentCreationLimiter,
  communityPostLimiter,
  communityCommentLimiter,
  communityLikeLimiter,
  bookingLimiter
};
