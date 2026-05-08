import axios from 'axios';

// Simple in-memory OTP service - no external providers needed
const otpStore = new Map();
const OTP_EXPIRY_MINUTES = 10;

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
 * @returns {Promise<{success: boolean, message: string, otp?: string}>}
 */
export const sendOTP = async (phone) => {
  try {
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');

    if (cleanPhone.length !== 10) {
      throw new Error('Invalid phone number. Must be 10 digits.');
    }

    const otp = generateOTP();

    // Send OTP via Seveno Media GET API
    try {
      const message = `Your OTP for PARAM is ${otp}. Do Not Share it.`;
      const smsUrl =
        'https://vas.sevenomedia.com/domestic/sendsms/bulksms_v2.php' +
        `?apikey=dDJuYW1qaW46UG5DNDlGMnI=` +
        `&sender=${encodeURIComponent('NamJin')}` +
        `&mobile=${encodeURIComponent(`91${cleanPhone}`)}` +
        `&message=${encodeURIComponent(message)}` +
        `&entityId=${encodeURIComponent('1201159239283403256')}` +
        `&templateId=${encodeURIComponent('1707177796052193562')}`;

      // Print final generated URL before sending
      console.log('=== SMS URL ===');
      console.log(smsUrl);    
      console.log('===============');

      const response = await axios.get(smsUrl);
      const responseText = String(response.data ?? '').trim();
      const isSuccess = responseText.toUpperCase().includes('SUCCESS');

      console.log('SMS API Status:', response.status);
      console.log('SMS API Response:', responseText);

      if (!isSuccess) {
        throw new Error(`SMS provider rejected request: ${responseText || 'Empty response'}`);
      }

      const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);
      otpStore.set(cleanPhone, {
        otp,
        expiresAt,
        attempts: 0
      });

      console.log(`OTP sent for +91${cleanPhone}: ${otp}`);
    } catch (smsError) {
      const providerResponse = smsError.response?.data != null
        ? String(smsError.response.data)
        : '';
      const details = providerResponse || smsError.message;
      console.error('SMS send failed:', details);
      throw new Error(`Failed to send OTP SMS: ${details}`);
    }

    return {
      success: true,
      message: 'OTP generated and sent successfully',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined // Return OTP for testing in dev only
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Generate OTP Error:', error.message);
    }
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
      if (process.env.NODE_ENV === 'development') {
        console.log(`OTP verified for +91${cleanPhone}`);
      }
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
    if (process.env.NODE_ENV === 'development') {
      console.error('Verify OTP Error:', error.message);
    }
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
