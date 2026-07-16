import { create } from 'zustand';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/api';
import * as Haptics from 'expo-haptics';
import {
  storeTokenSecurely,
  storeRefreshTokenSecurely,
  getTokenSecurely,
  getRefreshTokenSecurely,
  clearSecureTokens,
  isBiometricAvailable,
  authenticateWithBiometrics
} from '../utils/biometricAuth';
import { useMembershipStore } from './membershipStore';
import { getDeviceDetailsMobile } from '../utils/deviceInfo';

interface User {
  _id: string;
  clerkId?: string;
  displayName: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  authProvider: 'google' | 'phone' | 'clerk';
  subscriptionPlan: string;
  subscriptionStatus: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  biometricEnabled: boolean;

  googleSignIn: (idToken: string, revokeDeviceId?: string) => Promise<{ success: boolean; message?: string }>;
  syncClerkUser: (clerkData: { clerkId: string; email?: string; displayName?: string; photoURL?: string; referralCode?: string; clerkToken?: string }, revokeDeviceId?: string) => Promise<{ success: boolean; message?: string; needsPhoneVerification?: boolean; deviceLimitExceeded?: boolean; activeDevices?: any[] }>;
  sendOTP: (phone: string, purpose?: 'signin' | 'signup') => Promise<{ success: boolean; message?: string; isNewUser?: boolean }>;
  verifyOTP: (phone: string, code: string, name?: string, email?: string, revokeDeviceId?: string, referralCode?: string) => Promise<{ success: boolean; message?: string; isNewUser?: boolean; deviceLimitExceeded?: boolean; activeDevices?: any[] }>;
  logout: () => Promise<void>;
  logoutWithBiometric: () => Promise<{ success: boolean; message?: string }>;
  loadUser: () => Promise<void>;
  fetchCurrentUser: () => Promise<{ success: boolean; user?: User }>;
  refreshAuth: () => Promise<void>;
  checkBiometricAvailability: () => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
}

const getAuthHeaders = async (token?: string | null, revokeDeviceId?: string) => {
  const device = await getDeviceDetailsMobile();
  const headers: any = {
    'x-device-id': device.deviceId,
    'x-device-name': device.deviceName,
    'x-device-os': device.os,
    'x-device-browser': device.browser
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (revokeDeviceId) {
    headers['x-revoke-device-id'] = revokeDeviceId;
  }
  return headers;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,
  error: null,
  biometricEnabled: false,

  googleSignIn: async (_idToken: string, _revokeDeviceId?: string) => {
    // Deprecated: Google sign-in is now handled via Clerk OAuth.
    // Use syncClerkUser() instead with a Clerk-issued session token.
    console.warn('googleSignIn is deprecated. Use Clerk OAuth via syncClerkUser instead.');
    return { success: false, message: 'Google sign-in is now handled via Clerk. Please use Clerk OAuth.' };
  },

  syncClerkUser: async (clerkData: { clerkId: string; email?: string; displayName?: string; photoURL?: string; referralCode?: string; clerkToken?: string }, revokeDeviceId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders(null, revokeDeviceId);
      if (clerkData.clerkToken) {
        headers.Authorization = `Bearer ${clerkData.clerkToken}`;
      }
      const response = await axios.post(`${API_URL}/auth/clerk-sync`, clerkData, { headers });

      if (response.data?.success) {
        const user = response.data?.user;
        const token = response.data?.token;
        const refreshToken = response.data?.refreshToken;
        
        await AsyncStorage.setItem('user', JSON.stringify(user));
        await storeTokenSecurely(token);
        if (refreshToken) {
          await storeRefreshTokenSecurely(refreshToken);
        }
        
        set({ user, token, refreshToken, isLoading: false });
        return { success: true, needsPhoneVerification: !!response.data?.needsPhoneVerification };
      }

      set({ isLoading: false, error: response.data?.message });
      return { success: false, message: response.data?.message };
    } catch (error: any) {
      const data = error.response?.data;
      if (data?.deviceLimitExceeded || data?.cooldown) {
        set({ isLoading: false });
        return {
          success: false,
          deviceLimitExceeded: data?.deviceLimitExceeded || false,
          activeDevices: data?.activeDevices || [],
          message: data?.message
        };
      }
      const msg = error.response?.data?.message || 'Failed to sync Google user';
      set({ isLoading: false, error: msg });
      return { success: false, message: msg };
    }
  },

  sendOTP: async (phone: string, purpose?: 'signin' | 'signup') => {
    set({ isLoading: true, error: null });
    try {
      const token = get().token;
      const headers: any = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await axios.post(
        `${API_URL}/auth/send-otp`,
        { phone, purpose },
        { 
          timeout: 15000,
          headers
        }
      );

      set({ isLoading: false });
      const data = response.data || {};
      return {
        success: !!data.success,
        message: data.message,
        isNewUser: data.isNewUser
      };
    } catch (error: any) {
      let msg = 'Failed to send OTP. Please try again.';
      let isNewUser: boolean | undefined;

      if (error.response) {
        const data = error.response.data;
        isNewUser = data?.isNewUser;

        if (error.response.status === 429) {
          msg = data?.message || 'Too many OTP requests. Please wait 10 minutes and try again.';
        } else if (error.response.status === 404) {
          msg = data?.message || 'Account not found. Please sign up first.';
        } else if (error.response.status === 409) {
          msg = data?.message || 'Account already exists. Please sign in instead.';
        } else if (error.response.status === 400) {
          msg = data?.message || 'Invalid phone number. Use 10 digits (e.g. 9876543210).';
        } else {
          msg = data?.message || `Server error (${error.response.status}). Please try again.`;
        }
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        msg = `Request timed out. Trying: ${API_URL}`;
      } else if (error.request) {
        msg = `Cannot reach server at ${API_URL}. Check internet connection.`;
      }

      set({ isLoading: false, error: msg });
      return { success: false, message: msg, isNewUser };
    }
  },

  verifyOTP: async (phone: string, code: string, name?: string, email?: string, revokeDeviceId?: string, referralCode?: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = get().token;
      const headers = await getAuthHeaders(token, revokeDeviceId);
      const response = await axios.post(
        `${API_URL}/auth/verify-otp`, 
        {
          phone,
          otp: code,
          name,
          email,
          referralCode
        },
        { headers }
      );

      if (response.data?.success) {
        const user = response.data?.user;
        const token = response.data?.token;
        const refreshToken = response.data?.refreshToken;
        const isNewUser = response.data?.isNewUser;
        
        await AsyncStorage.setItem('user', JSON.stringify(user));
        await storeTokenSecurely(token);
        if (refreshToken) {
          await storeRefreshTokenSecurely(refreshToken);
        }
        
        // Sync assessment completion status from server
        if (user.assessmentCompleted) {
          await AsyncStorage.setItem('assessment_completed', 'true');
        } else {
          await AsyncStorage.removeItem('assessment_completed');
        }
        
        set({ user, token, refreshToken, isLoading: false });
        return { success: true, isNewUser };
      }

      set({ isLoading: false, error: response.data?.message });
      return { success: false, message: response.data?.message };
    } catch (error: any) {
      const data = error.response?.data;
      if (data?.deviceLimitExceeded || data?.cooldown) {
        set({ isLoading: false });
        return {
          success: false,
          deviceLimitExceeded: data?.deviceLimitExceeded || false,
          activeDevices: data?.activeDevices || [],
          message: data?.message
        };
      }
      let msg = 'Verification failed. Please try again.';
      
      if (error.response) {
        // Server responded with error
        if (error.response.status === 429) {
          msg = error.response.data?.message || 'Too many verification attempts. Please wait 10 minutes and try again.';
        } else if (error.response.status === 400) {
          msg = error.response.data?.message || 'Invalid OTP. Please check and try again.';
        } else if (error.response.status === 401) {
          msg = error.response.data?.message || 'OTP expired or invalid. Please request a new one.';
        } else {
          msg = error.response.data?.message || `Server error (${error.response.status}). Please try again.`;
        }
      } else if (error.request) {
        // Request made but no response
        msg = 'Cannot reach server. Check your internet connection.';
      }
      
      set({ isLoading: false, error: msg });
      return { success: false, message: msg };
    }
  },

  logout: async () => {
    const token = await getTokenSecurely();

    try {
      if (token) {
        const headers = await getAuthHeaders(token);
        await axios.post(`${API_URL}/auth/logout`, {}, { headers });
      }
    } finally {
      // Always clear local auth state so stale sessions cannot survive a failed logout call.
      await clearSecureTokens();
      await AsyncStorage.multiRemove(['token', 'refreshToken', 'user', 'assessment_completed']);
      set({ user: null, token: null, refreshToken: null });
      
      // Clear membership cache on logout
      useMembershipStore.getState().clearMembership();
    }
  },

  logoutWithBiometric: async () => {
    const available = await isBiometricAvailable();
    
    if (available) {
      const authenticated = await authenticateWithBiometrics({
        promptMessage: 'Authenticate to sign out',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel'
      });
      
      if (!authenticated) {
        return { success: false, message: 'Authentication failed' };
      }
    }
    
    await get().logout();
    
    // Haptic feedback for successful logout
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    return { success: true };
  },

  loadUser: async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const token = await getTokenSecurely();
      const refreshToken = await getRefreshTokenSecurely();
      const biometricEnabled = await isBiometricAvailable();

      if (userStr && !token) {
        // A cached user without a token is a broken session; clear it instead of treating it as logged in.
        await clearSecureTokens();
        await AsyncStorage.multiRemove(['token', 'refreshToken', 'user', 'assessment_completed']);
        set({ user: null, token: null, refreshToken: null, biometricEnabled });
        return;
      }

      if (userStr && token) {
        set({
          user: JSON.parse(userStr),
          token,
          refreshToken,
          biometricEnabled
        });
        return;
      }

      set({ user: null, token: null, refreshToken: null, biometricEnabled });
    } catch (error) {
      set({ user: null, token: null, refreshToken: null, biometricEnabled: false });
    }
  },

  fetchCurrentUser: async () => {
    try {
      const token = await getTokenSecurely();
      if (!token) {
        return { success: false };
      }

      const headers = await getAuthHeaders(token);
      const response = await axios.get(`${API_URL}/auth/me`, { headers });

      if (response.data?.success) {
        const user = response.data?.user;
        
        // Update AsyncStorage with fresh user data
        await AsyncStorage.setItem('user', JSON.stringify(user));
        
        // Sync assessment completion status from server
        if (user.assessmentCompleted) {
          await AsyncStorage.setItem('assessment_completed', 'true');
        } else {
          await AsyncStorage.removeItem('assessment_completed');
        }
        
        set({ user, token, refreshToken: await getRefreshTokenSecurely() });
        return { success: true, user };
      }
      
      return { success: false };
    } catch (error: any) {
      // 401/400/403 = invalid or bad auth - clear local data and treat as logged out
      const status = error.response?.status;
      if (status === 401 || status === 400 || status === 403) {
        await clearSecureTokens();
        await AsyncStorage.multiRemove(['user', 'assessment_completed']);
        set({ user: null, token: null, refreshToken: null });
      }
      
      return { success: false };
    }
  },

  refreshAuth: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) {
      return;
    }

    try {
      set({ isLoading: true });
      const headers = await getAuthHeaders();
      const response = await axios.post(`${API_URL}/auth/refresh-token`, {
        refreshToken
      }, { headers });

      if (response.data?.success) {
        const { token, refreshToken: newRefreshToken } = response.data || {};
        if (token) {
          await storeTokenSecurely(token);
        }
        if (newRefreshToken) {
          await storeRefreshTokenSecurely(newRefreshToken);
        }
        set({ token, refreshToken: newRefreshToken || refreshToken, isLoading: false });
      }
    } catch (error) {
        // On refresh failure, logout user
        await get().logout();
        set({ isLoading: false });
      }
  },

  checkBiometricAvailability: async () => {
    const available = await isBiometricAvailable();
    set({ biometricEnabled: available });
    return available;
  },

  enableBiometric: async () => {
    const authenticated = await authenticateWithBiometrics({
      promptMessage: 'Enable biometric authentication',
      fallbackLabel: 'Use passcode'
    });
    
    if (authenticated) {
      await AsyncStorage.setItem('biometric_enabled', 'true');
      set({ biometricEnabled: true });
      return true;
    }
    
    return false;
  },

  disableBiometric: async () => {
    await AsyncStorage.removeItem('biometric_enabled');
    set({ biometricEnabled: false });
  },
}));
