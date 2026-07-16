import crypto from 'crypto';
import { User } from '../models/user.models.js';

/**
 * Generates a unique referral code formatted as PARAM-XXXXXX
 */
export const generateUniqueReferralCode = async () => {
  let isUnique = false;
  let code = '';

  while (!isUnique) {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    code = `PARAM-${randomHex}`;

    const existing = await User.findOne({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
};
