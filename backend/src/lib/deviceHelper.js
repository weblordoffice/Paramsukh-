import crypto from 'crypto';

/**
 * Extracts device identification and metadata from incoming request headers
 * Falls back to user-agent heuristics and SHA-256 fingerprinting for web clients
 */
export const getDeviceDetails = (req) => {
  let deviceId = req.headers['x-device-id'] || '';
  const deviceName = req.headers['x-device-name'] || '';
  const os = req.headers['x-device-os'] || '';
  const browser = req.headers['x-device-browser'] || '';
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  let fallbackOs = 'Unknown OS';
  let fallbackBrowser = 'Unknown Browser';

  if (/windows/i.test(userAgent)) fallbackOs = 'Windows';
  else if (/macintosh|mac os/i.test(userAgent)) fallbackOs = 'macOS';
  else if (/iphone|ipad|ipod/i.test(userAgent)) fallbackOs = 'iOS';
  else if (/android/i.test(userAgent)) fallbackOs = 'Android';
  else if (/linux/i.test(userAgent)) fallbackOs = 'Linux';

  if (/chrome|crios/i.test(userAgent)) fallbackBrowser = 'Chrome';
  else if (/firefox|fxios/i.test(userAgent)) fallbackBrowser = 'Firefox';
  else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) fallbackBrowser = 'Safari';
  else if (/msie|trident/i.test(userAgent)) fallbackBrowser = 'Internet Explorer';
  else if (/edge/i.test(userAgent)) fallbackBrowser = 'Edge';

  // If no device ID provided in headers, generate a stable one based on IP + userAgent
  if (!deviceId) {
    const hash = crypto.createHash('sha256');
    hash.update(`${ip}-${userAgent}`);
    deviceId = `web-${hash.digest('hex').substring(0, 16)}`;
  }

  return {
    deviceId: deviceId.trim(),
    deviceName: deviceName.trim() || `${fallbackBrowser} on ${fallbackOs}`,
    os: os.trim() || fallbackOs,
    browser: browser.trim() || fallbackBrowser
  };
};
