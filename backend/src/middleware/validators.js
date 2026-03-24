// Input Validation Middleware
import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Authentication Validators
 */
export const validateSendOTP = [
  body('phone')
    .matches(/^(\+91)?[6-9]\d{9}$/)
    .withMessage('Phone number must be a valid Indian mobile number (e.g., 9876543210 or +919876543210)'),
  handleValidationErrors
];

export const validateVerifyOTP = [
  body('phone')
    .matches(/^(\+91)?[6-9]\d{9}$/)
    .withMessage('Phone number must be a valid Indian mobile number (e.g., 9876543210 or +919876543210)'),
  body('otp')
    .isString()
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be a 6-digit number'),
  handleValidationErrors
];

/**
 * User Profile Validators
 */
export const validateUpdateProfile = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Display name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
  body('photoURL')
    .optional()
    .isURL()
    .withMessage('Photo URL must be a valid URL'),
  handleValidationErrors
];

/**
 * Course Validators
 */
export const validateCreateCourse = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Course title must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Course description must be at least 10 characters'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required'),
  handleValidationErrors
];

export const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  handleValidationErrors
];

/**
 * Event Validators
 */
export const validateCreateEvent = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Event title must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Event description must be at least 10 characters'),
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Start date cannot be in the past');
      }
      return true;
    }),
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('maxParticipants')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max participants must be at least 1'),
  handleValidationErrors
];

/**
 * Product Validators
 */
export const validateCreateProduct = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Product name must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Product description must be at least 10 characters'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  handleValidationErrors
];

/**
 * Booking Validators
 */
export const validateBookCounseling = [
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid date')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Booking date cannot be in the past');
      }
      return true;
    }),
  body('timeSlot')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Time slot must be in format HH:MM-HH:MM'),
  body('sessionType')
    .isIn(['online', 'offline'])
    .withMessage('Session type must be either online or offline'),
  handleValidationErrors
];

/**
 * Payment Validators
 */
export const validateCreateOrder = [
  body('plan')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Plan is required'),
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be greater than 0'),
  handleValidationErrors
];

export const validateVerifyPayment = [
  body('razorpay_order_id')
    .notEmpty()
    .withMessage('Order ID is required'),
  body('razorpay_payment_id')
    .notEmpty()
    .withMessage('Payment ID is required'),
  body('razorpay_signature')
    .notEmpty()
    .withMessage('Payment signature is required'),
  handleValidationErrors
];

/**
 * Assessment Validators
 */
export const validateSubmitAssessment = [
  body('physicalHealth')
    .isInt({ min: 1, max: 10 })
    .withMessage('Physical health score must be between 1 and 10'),
  body('mentalHealth')
    .isInt({ min: 1, max: 10 })
    .withMessage('Mental health score must be between 1 and 10'),
  body('spiritualHealth')
    .isInt({ min: 1, max: 10 })
    .withMessage('Spiritual health score must be between 1 and 10'),
  body('emotionalHealth')
    .isInt({ min: 1, max: 10 })
    .withMessage('Emotional health score must be between 1 and 10'),
  handleValidationErrors
];

/**
 * Pagination Validators
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

/**
 * Search Validators
 */
export const validateSearch = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must not exceed 200 characters'),
  handleValidationErrors
];

/**
 * Cart Validators
 */
export const validateAddToCart = [
  body('productId')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('quantity')
    .isInt({ min: 1, max: 50 })
    .withMessage('Quantity must be between 1 and 50'),
  body('variantId')
    .optional()
    .isMongoId()
    .withMessage('Invalid variant ID'),
  handleValidationErrors
];

/**
 * Community Validators
 */
export const validateCreatePost = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Post content must be between 1 and 5000 characters'),
  body('images')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Maximum 10 images allowed'),
  handleValidationErrors
];

export const validateCreateComment = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1 and 2000 characters'),
  handleValidationErrors
];

/**
 * Shop Validators
 */
export const validateRegisterShop = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Shop name must be between 3 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Shop description must be between 10 and 1000 characters'),
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Phone number must be a valid 10-digit Indian mobile number'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
  handleValidationErrors
];

/**
 * Address Validators
 */
export const validateCreateAddress = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Phone number must be a valid 10-digit Indian mobile number'),
  body('pincode')
    .matches(/^[1-9][0-9]{5}$/)
    .withMessage('Pincode must be a valid 6-digit Indian pincode'),
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('addressLine1')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address line 1 must be between 5 and 200 characters'),
  handleValidationErrors
];

export default {
  validateSendOTP,
  validateVerifyOTP,
  validateUpdateProfile,
  validateCreateCourse,
  validateCreateEvent,
  validateCreateProduct,
  validateBookCounseling,
  validateCreateOrder,
  validateVerifyPayment,
  validateSubmitAssessment,
  validatePagination,
  validateSearch,
  validateAddToCart,
  validateCreatePost,
  validateCreateComment,
  validateRegisterShop,
  validateCreateAddress,
  validateMongoId,
  handleValidationErrors
};
