import crypto from 'crypto';
import { User } from '../models/user.models.js';
import ReferralConfig from '../models/referralConfig.models.js';

const BASE64_ALPHABET_PATTERN = /[+/=0OIl]/g;

const randomAlphanumeric = (length) => {
  let encoded = '';
  while (encoded.length < length) {
    encoded += crypto.randomBytes(length).toString('base64')
      .replace(BASE64_ALPHABET_PATTERN, '')
      .toUpperCase();
  }
  return encoded.substring(0, length);
};

/**
 * Generates a unique referral code.
 * Format is driven by ReferralConfig.referralCodeFormat:
 *   - 'random8'  (default): PARAM-XXXXXXXX  (8 random chars)
 *   - 'random12'           : PARAM-XXXXXXXXXXXX (12 random chars)
 *   - 'displayName'        : <NAME>-XXXX based on the user's display name
 * Uniqueness is guaranteed by retrying until no existing user holds the code.
 */
export const generateUniqueReferralCode = async (displayName = '') => {
  let isUnique = false;
  let code = '';

  const config = await ReferralConfig.findOne().catch(() => null);
  const format = config?.referralCodeFormat || 'random8';

  while (!isUnique) {
    if (format === 'displayName' && displayName) {
      const base = displayName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PARAM';
      code = `${base}-${randomAlphanumeric(4)}`;
    } else {
      const len = format === 'random12' ? 12 : 8;
      code = `PARAM-${randomAlphanumeric(len)}`;
    }

    const existing = await User.findOne({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
};
