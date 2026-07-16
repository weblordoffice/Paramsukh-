import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'stable_device_id';

/**
 * Gets or generates a stable persistent device UUID, and retrieves hardware metadata
 */
export const getDeviceDetailsMobile = async () => {
  let deviceId = '';
  try {
    deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY) || '';
  } catch (e) {
    console.warn('Failed to read device ID from secure store:', e);
  }

  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    try {
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    } catch (e) {
      console.warn('Failed to persist device ID in secure store:', e);
    }
  }

  const fallbackOs = Platform.OS === 'ios' ? 'iOS' : 'Android';
  const os = Device.osName || fallbackOs;
  const brand = Device.brand || '';
  const model = Device.modelName || 'Device';
  const deviceName = brand ? `${brand} ${model}`.trim() : model;

  return {
    deviceId,
    deviceName,
    os,
    browser: 'Native App'
  };
};
