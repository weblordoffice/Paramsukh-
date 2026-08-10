import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'stable_device_id';

/**
 * Gets or generates a stable persistent device UUID, and retrieves hardware metadata.
 * Uses expo-application's installation ID which persists across reinstalls
 * (backed by Android Keystore / iOS Keychain).
 */
export const getDeviceDetailsMobile = async () => {
  // Try hardware-based installation ID first (survives reinstalls)
  let deviceId = '';
  try {
    deviceId = await Application.getInstallationIdAsync();
  } catch (e) {
    console.warn('[DeviceInfo] Failed to get installation ID:', e);
  }

  // Fallback: SecureStore cached ID → random UUID
  if (!deviceId) {
    try {
      deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY) || '';
    } catch (e) {
      console.warn('[DeviceInfo] Failed to read from SecureStore:', e);
    }
    if (!deviceId) {
      deviceId = Crypto.randomUUID();
      try {
        await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      } catch (e) {
        console.warn('[DeviceInfo] Failed to persist device ID:', e);
      }
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
