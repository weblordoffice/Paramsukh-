import Constants from 'expo-constants';

const normalizeBaseUrl = (value: string) =>
  value.replace(/\/api\/?$/, '').replace(/\/auth\/?$/, '').replace(/\/$/, '');

// Prefer a local Expo env override for development, then fall back to app config.
const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return normalizeBaseUrl(envUrl);
  }

  // Dynamically resolve local backend IP during development to adapt to network changes
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri || '';
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip) {
        return `http://${ip}:3000`;
      }
    }
  }

  const configUrl = Constants.expoConfig?.extra?.apiUrl;
  if (typeof configUrl === 'string' && configUrl.trim() !== '') {
    return normalizeBaseUrl(configUrl);
  }

  return 'https://api.getbill.in';
};

export const BASE_URL = getBaseUrl();
if (__DEV__) {
  console.log('[API Config] Resolved BASE_URL:', BASE_URL);
}
export const API_BASE_URL = `${BASE_URL}/api`;
export const API_URL = API_BASE_URL;
