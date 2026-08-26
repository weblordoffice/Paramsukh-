import crypto from 'crypto';
import { User } from '../models/user.models.js';
import ReferralConfig from '../models/referralConfig.models.js';

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
      const suffix = crypto.randomBytes(2).toString('base64')
        .replace(/[+/=]/g, '')
        .replace(/[0OIl]/g, '')
        .substring(0, 4)
        .toUpperCase();
      code = `${base}-${suffix}`;
    } else {
      const len = format === 'random12' ? 12 : 8;
      const randomBytes = crypto.randomBytes(Math.ceil(len * 0.75));
      const encoded = Buffer.from(randomBytes).toString('base64')
        .replace(/[+/=]/g, '')
        .replace(/[0OIl]/g, '')
        .substring(0, len)
        .toUpperCase();
      code = `PARAM-${encoded}`;
    }

    const existing = await User.findOne({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
};
