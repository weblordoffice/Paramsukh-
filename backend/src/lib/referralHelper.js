import crypto from 'crypto';
import { User } from '../models/user.models.js';

/**
 * Generates a unique referral code formatted as PARAM-XXXXXXXX
 * 6 random bytes → 8 alphanumeric chars → 48-bit entropy (~281 trillion combinations)
 */
export const generateUniqueReferralCode = async () => {
  let isUnique = false;
  let code = '';

  while (!isUnique) {
    const randomBytes = crypto.randomBytes(6);
    const encoded = Buffer.from(randomBytes).toString('base64')
      .replace(/[+/=]/g, '')
      .replace(/[0OIl]/g, '')
      .substring(0, 8)
      .toUpperCase();
    code = `PARAM-${encoded}`;

    const existing = await User.findOne({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
};
