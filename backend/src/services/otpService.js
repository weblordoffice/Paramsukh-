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

        // ── Debug: log everything for troubleshooting ──
        console.log('[OTP SMS] ── Request Debug ──');
        console.log('[OTP SMS] Message (raw)    :', message);
        console.log('[OTP SMS] Message (encoded):', encodeURIComponent(message));
        console.log('[OTP SMS] Mobile           :', cleanPhone);
        console.log('[OTP SMS] Final URL        :', smsUrl);

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
