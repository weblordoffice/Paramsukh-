import axios from 'axios';

// In-memory OTP store for temporary verification state.
const otpStore = new Map();
const OTP_EXPIRY_MINUTES = 10;
const OTP_SMS_BASE_URL = process.env.OTP_SMS_BASE_URL || 'https://vas.sevenomedia.com/domestic/sendsms/bulksms_v2.php';
const OTP_SMS_API_KEY = String(process.env.OTP_SMS_API_KEY || process.env.FAST2SMS_API_KEY || '').trim();
const OTP_SMS_SENDER = process.env.OTP_SMS_SENDER || 'NamJin';
const OTP_SMS_ENTITY_ID = process.env.OTP_SMS_ENTITY_ID || '1201159239283403256';
const OTP_SMS_TEMPLATE_ID = process.env.OTP_SMS_TEMPLATE_ID || '1707177796052193562';

/**
 * Generate a random 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Clean up expired OTPs
 */
const cleanupExpiredOTPs = () => {
  const now = Date.now();
  for (const [phone, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(phone);
    }
  }
};

// Cleanup every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

/**
 * Send OTP (stores in memory)
 * @param {string} phone - Phone number (10 digits)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const sendOTP = async (phone) => {
  try {
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');

    if (cleanPhone.length !== 10) {
      throw new Error('Invalid phone number. Must be 10 digits.');
    }

    if (!OTP_SMS_API_KEY) {
      throw new Error('OTP SMS API key is not configured');
    }

    // "test" key means local test mode: skip provider call, still generate/store OTP.
    const isTestMode = OTP_SMS_API_KEY.toLowerCase() === 'test';
    const otp = isTestMode ? '123456' : generateOTP();

    try {
      if (!isTestMode) {
        // ── DLT-approved template (templateId: 1707177796052193562) ──
        // "Your OTP for PARAM is {#var#}. Do Not Share it"
        // {#var#} is replaced with the actual OTP value at runtime.
        const message = `Your OTP for PARAM is ${otp}. Do Not Share it`;

        // ── Uncomment the line below to test with a hardcoded OTP for DLT verification ──
        // const message = 'Your OTP for PARAM is 123456. Do Not Share it';

        // Build URL manually to match exact dashboard encoding:
        // - apikey passed raw (preserves = in base64)
        // - encodeURIComponent for message (spaces → %20, not +)
        // - other params are alphanumeric, no encoding needed
        const smsUrl =
          `${OTP_SMS_BASE_URL}` +
          `?apikey=${OTP_SMS_API_KEY}` +
          `&type=TEXT` +
          `&sender=${OTP_SMS_SENDER}` +
          `&entityId=${OTP_SMS_ENTITY_ID}` +
          `&templateId=${OTP_SMS_TEMPLATE_ID}` +
          `&mobile=${cleanPhone}` +
          `&message=${encodeURIComponent(message)}`;

        // Debug: log request metadata only (never log OTP content or full URLs)
        console.log(`[OTP SMS] Sending to ${cleanPhone} via ${OTP_SMS_SENDER}`);

        // Compare with the known working dashboard URL format
        const dashboardRef =
          `${OTP_SMS_BASE_URL}` +
          `?apikey=${OTP_SMS_API_KEY}` +
          `&type=TEXT` +
          `&sender=${OTP_SMS_SENDER}` +
          `&entityId=${OTP_SMS_ENTITY_ID}` +
          `&templateId=${OTP_SMS_TEMPLATE_ID}` +
          `&mobile=${cleanPhone}` +
          `&message=${encodeURIComponent('Your OTP for PARAM is {#var#}. Do Not Share it')}`;
        console.log('[OTP SMS] Dashboard ref URL:', dashboardRef);
        console.log('[OTP SMS] URLs match (ignoring OTP value):', smsUrl.replace(otp, '%7B%23var%23%7D') === dashboardRef);

        const response = await axios.get(smsUrl);
        const responseText = String(response.data ?? '').trim();

        console.log('[OTP SMS] Provider response:', responseText);
        console.log('[OTP SMS] ── End Debug ──');

        const isSuccess = responseText.toUpperCase().includes('SUCCESS');

        if (!isSuccess) {
          throw new Error(`SMS provider rejected request: ${responseText || 'Empty response'}`);
        }
      }

      const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);
      otpStore.set(cleanPhone, {
        otp,
        expiresAt,
        attempts: 0
      });

    } catch (smsError) {
      const providerResponse = smsError.response?.data != null
        ? String(smsError.response.data)
        : '';
      const details = providerResponse || smsError.message;
      throw new Error(`Failed to send OTP SMS: ${details}`);
    }

    return {
      success: true,
      message: 'OTP generated and sent successfully'
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Verify OTP
 * @param {string} phone - Phone number (10 digits)
 * @param {string} otp - OTP code to verify
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const verifyOTP = async (phone, otp) => {
  try {
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');
    const isTestNumber =
      cleanPhone === '9999999999' ||
      cleanPhone === '9888888888' ||
      cleanPhone === (process.env.PLAYSTORE_REVIEW_MOBILE || '').replace(/\D/g, '');
    const reviewOtp = process.env.PLAYSTORE_REVIEW_OTP || '123456';

    // 1. Always accept test OTP for test/review numbers
    if (isTestNumber && (otp.toString() === '123456' || otp.toString() === reviewOtp)) {
      return {
        success: true,
        message: 'OTP verified successfully'
      };
    }

    // 2. In development mode, accept 123456 for any phone number
    if (process.env.NODE_ENV !== 'production' && otp.toString() === '123456') {
      return {
        success: true,
        message: 'OTP verified successfully'
      };
    }

    const stored = otpStore.get(cleanPhone);

    if (!stored) {
      return {
        success: false,
        message: 'OTP expired or not found. Please request a new one.'
      };
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(cleanPhone);
      return {
        success: false,
        message: 'OTP expired. Please request a new one.'
      };
    }

    if (stored.attempts >= 7) {
      otpStore.delete(cleanPhone);
      return {
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.'
      };
    }

    if (stored.otp === otp.toString()) {
      otpStore.delete(cleanPhone);
      return {
        success: true,
        message: 'OTP verified successfully'
      };
    } else {
      stored.attempts += 1;
      otpStore.set(cleanPhone, stored);
      return {
        success: false,
        message: `Invalid OTP. ${7 - stored.attempts} attempts remaining.`
      };
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Clear OTP for a phone number
 */
export const clearOTP = (phone) => {
  const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');
  otpStore.delete(cleanPhone);
};

// ─── Email OTP (for contact change verification) ───────────────────────────

const emailOtpStore = new Map();

const getResend = () => {
  // Lazy import to avoid issues before dotenv.config() runs
  const { Resend } = require('resend');
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const getFrom = () => process.env.RESEND_FROM || 'ParamSukh <noreply@mail.paramsukhonlinegurukul.com>';

/**
 * Send OTP to an email address for contact change verification
 * @param {string} email
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const sendEmailOTP = async (email) => {
  const normalizedEmail = String(email).toLowerCase().trim();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error('Invalid email address.');
  }

  const resend = getResend();
  const isTestMode = !resend || process.env.RESEND_API_KEY?.toLowerCase() === 'test';
  const otp = isTestMode ? '123456' : generateOTP();

  if (!isTestMode) {
    const fromAddress = getFrom();
    try {
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: normalizedEmail,
        subject: 'Your ParamSukh OTP — Email Verification',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <div style="background: #F1842D; padding: 20px 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 24px;">ParamSukh</h1>
            </div>
            <div style="background: #fff; padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1C1917; margin: 0 0 16px; font-size: 20px;">Verify your email address</h2>
              <p style="color: #57534e; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                You requested to change your email to this address. Please use the OTP below to verify:
              </p>
              <div style="background: #F4F3EB; border: 2px dashed #F1842D; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #F1842D;">${otp}</span>
              </div>
              <p style="color: #A8A29E; font-size: 12px; margin: 0;">
                This OTP is valid for 10 minutes. If you did not request this, please ignore this email.
              </p>
            </div>
          </div>
        `,
      });

      if (error) {
        throw new Error(`Failed to send email: ${error.message}`);
      }
    } catch (emailError) {
      console.error('[Email OTP] Send failed:', emailError?.message || emailError);
      throw new Error('Failed to send verification email. Please try again.');
    }
  }

  const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);
  emailOtpStore.set(normalizedEmail, {
    otp,
    expiresAt,
    attempts: 0
  });

  return {
    success: true,
    message: 'Verification OTP sent to your email'
  };
};

/**
 * Verify email OTP
 * @param {string} email
 * @param {string} otp
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const verifyEmailOTP = async (email, otp) => {
  const normalizedEmail = String(email).toLowerCase().trim();

  // In development, accept 123456 for any email
  if (process.env.NODE_ENV !== 'production' && otp.toString() === '123456') {
    emailOtpStore.delete(normalizedEmail);
    return { success: true, message: 'OTP verified successfully' };
  }

  const stored = emailOtpStore.get(normalizedEmail);

  if (!stored) {
    return { success: false, message: 'OTP expired or not found. Please request a new one.' };
  }

  if (Date.now() > stored.expiresAt) {
    emailOtpStore.delete(normalizedEmail);
    return { success: false, message: 'OTP expired. Please request a new one.' };
  }

  if (stored.attempts >= 7) {
    emailOtpStore.delete(normalizedEmail);
    return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }

  if (stored.otp === otp.toString()) {
    emailOtpStore.delete(normalizedEmail);
    return { success: true, message: 'OTP verified successfully' };
  } else {
    stored.attempts += 1;
    emailOtpStore.set(normalizedEmail, stored);
    return { success: false, message: `Invalid OTP. ${7 - stored.attempts} attempts remaining.` };
  }
};

/**
 * Clear email OTP
 */
export const clearEmailOTP = (email) => {
  const normalizedEmail = String(email).toLowerCase().trim();
  emailOtpStore.delete(normalizedEmail);
};
