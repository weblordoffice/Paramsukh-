import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

interface BiometricAuthOptions {
  promptMessage?: string;
  fallbackLabel?: string;
  cancelLabel?: string;
}

export const BIOMETRIC_KEY = 'biometric_enabled';
export const SECURE_TOKEN_KEY = 'auth_token';
export const SECURE_REFRESH_KEY = 'refresh_token';

/**
 * Check if device supports biometric authentication
 */
export const isBiometricAvailable = async (): Promise<boolean> => {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      return false;
    }

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch (error) {
    return false;
  }
};

/**
 * Get available authentication types
 */
export const getAuthenticationTypes = async (): Promise<LocalAuthentication.AuthenticationType[]> => {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return types;
  } catch (error) {
    return [];
  }
};

/**
 * Enable biometric authentication for the app
 */
export const enableBiometricAuth = async (): Promise<boolean> => {
  try {
    const available = await isBiometricAvailable();
    if (!available) {
      return false;
    }

    await AsyncStorage.setItem(BIOMETRIC_KEY, 'true');
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Disable biometric authentication
 */
export const disableBiometricAuth = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(BIOMETRIC_KEY);
  } catch (error) {
  }
};

/**
 * Check if biometric auth is enabled
 */
export const isBiometricEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await AsyncStorage.getItem(BIOMETRIC_KEY);
    return enabled === 'true';
  } catch (error) {
    return false;
  }
};

/**
 * Authenticate user with biometrics
 */
export const authenticateWithBiometrics = async (
  options: BiometricAuthOptions = {}
): Promise<boolean> => {
  const {
    promptMessage = 'Authenticate to continue',
    fallbackLabel = 'Use passcode',
    cancelLabel = 'Cancel'
  } = options;

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel,
      cancelLabel,
      disableDeviceFallback: false,
    });

    if (result.success) {
      // Provide haptic feedback on success
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    }

    return false;
  } catch (error) {
    // Provide haptic feedback on failure
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    return false;
  }
};

/**
 * Store token securely
 */
export const storeTokenSecurely = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
  } catch (error) {
    // Fallback to AsyncStorage
    await AsyncStorage.setItem('token', token);
  }
};

/**
 * Store refresh token securely
 */
export const storeRefreshTokenSecurely = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(SECURE_REFRESH_KEY, token);
  } catch (error) {
    // Fallback to AsyncStorage
    await AsyncStorage.setItem('refreshToken', token);
  }
};

/**
 * Get token from secure storage
 */
export const getTokenSecurely = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
    return token;
  } catch (error) {
    // Fallback to AsyncStorage
    return await AsyncStorage.getItem('token');
  }
};

/**
 * Get refresh token from secure storage
 */
export const getRefreshTokenSecurely = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync(SECURE_REFRESH_KEY);
    return token;
  } catch (error) {
    // Fallback to AsyncStorage
    return await AsyncStorage.getItem('refreshToken');
  }
};

/**
 * Clear all secure tokens
 */
export const clearSecureTokens = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
    await SecureStore.deleteItemAsync(SECURE_REFRESH_KEY);
  } catch (error) {
    // Fallback to AsyncStorage
    await AsyncStorage.multiRemove(['token', 'refreshToken']);
  }
};
