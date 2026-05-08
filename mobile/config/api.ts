import Constants from 'expo-constants';

// Production-first API config for release builds
const getBaseUrl = () => {
  if (Constants.expoConfig?.extra?.apiUrl) {
    return Constants.expoConfig.extra.apiUrl.replace(/\/api\/?$/, '').replace(/\/auth\/?$/, '');
  }

  return 'https://api.getbill.in';
};

export const BASE_URL = getBaseUrl();
export const API_BASE_URL = `${BASE_URL}/api`;
export const API_URL = API_BASE_URL;
export const RAZORPAY_KEY_ID = Constants.expoConfig?.extra?.razorpayKeyId || '';

