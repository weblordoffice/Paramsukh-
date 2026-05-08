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

    const otp = generateOTP();

    if (!OTP_SMS_API_KEY) {
      throw new Error('OTP SMS API key is not configured');
    }

    // "test" key means local test mode: skip provider call, still generate/store OTP.
    const isTestMode = OTP_SMS_API_KEY.toLowerCase() === 'test';

    try {
      if (!isTestMode) {
        const message = `Your OTP for PARAM is ${otp}. Do Not Share it.`;
        const smsUrl =
          `${OTP_SMS_BASE_URL}` +
          `?apikey=${encodeURIComponent(OTP_SMS_API_KEY)}` +
          `&sender=${encodeURIComponent(OTP_SMS_SENDER)}` +
          `&mobile=${encodeURIComponent(`91${cleanPhone}`)}` +
          `&message=${encodeURIComponent(message)}` +
          `&entityId=${encodeURIComponent(OTP_SMS_ENTITY_ID)}` +
          `&templateId=${encodeURIComponent(OTP_SMS_TEMPLATE_ID)}`;

        const response = await axios.get(smsUrl);
        const responseText = String(response.data ?? '').trim();
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

    if (stored.attempts >= 3) {
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
        message: `Invalid OTP. ${3 - stored.attempts} attempts remaining.`
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
