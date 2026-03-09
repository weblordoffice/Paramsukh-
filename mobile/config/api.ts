import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Dynamically retrieve the host if available (for Expo Go / Dev Client)
const getHost = () => {
  // If defined in expoConfig (standard in newer Expo versions)
  if (Constants.expoConfig?.hostUri) {
    return Constants.expoConfig.hostUri.split(':')[0];
  }
  // Fallback for older Expo versions or bare workflow
  // @ts-ignore
  if (Constants.manifest?.debuggerHost) {
    // @ts-ignore
    return Constants.manifest.debuggerHost.split(':')[0];
  }
  return null;
};

// Your machine's IP — find it: run "ipconfig" and use the IPv4 under Wi-Fi or Ethernet (not 172.x)
const FALLBACK_IPS = [
  '192.168.1.47',  // This PC (from ipconfig — update if your IP changes)
  '192.168.0.104',
  '192.168.0.103',
];

// Select the IP: Dynamic Host > First Fallback > Localhost
const LOCAL_IP = getHost() || FALLBACK_IPS[0];

// Determine the Base URL (without /api/auth or /api)
const getBaseUrl = () => {
  // In development, ALWAYS prioritize local server
  if (__DEV__) {
    console.log('🚧 Running in DEV mode, using local backend:', `http://${LOCAL_IP}:3000`);
    return `http://${LOCAL_IP}:3000`;
  }

  // Only use config API URL in production
  if (Constants.expoConfig?.extra?.apiUrl) {
    return Constants.expoConfig.extra.apiUrl.replace(/\/api\/?$/, '').replace(/\/auth\/?$/, '');
  }

  // Fallback production URL
  return 'https://api.getbill.in';
};

export const BASE_URL = getBaseUrl();
export const API_BASE_URL = `${BASE_URL}/api`;
export const API_URL = API_BASE_URL; // Correctly pointing to .../api now

console.log('🌐 API Configuration:', {
  LOCAL_IP,
  BASE_URL,
  API_BASE_URL,
  API_URL
});

export const RAZORPAY_KEY_ID = Constants.expoConfig?.extra?.razorpayKeyId || 'rzp_test_SHVs60hci108TL';

