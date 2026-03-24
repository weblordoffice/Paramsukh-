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

interface User {
  _id: string;
  displayName: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  authProvider: 'google' | 'phone';
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

  googleSignIn: (idToken: string) => Promise<{ success: boolean; message?: string }>;
  sendOTP: (phone: string) => Promise<{ success: boolean; message?: string; isNewUser?: boolean; otp?: string }>;
  verifyOTP: (phone: string, code: string, name?: string, email?: string) => Promise<{ success: boolean; message?: string; isNewUser?: boolean }>;
  logout: () => Promise<void>;
  logoutWithBiometric: () => Promise<{ success: boolean; message?: string }>;
  loadUser: () => Promise<void>;
  fetchCurrentUser: () => Promise<{ success: boolean; user?: User }>;
  refreshAuth: () => Promise<void>;
  checkBiometricAvailability: () => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
}

// TEMPORARY: Mock user for development (bypass authentication)


export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,
  error: null,
  biometricEnabled: false,

  googleSignIn: async (idToken: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${API_URL}/auth/google`, { idToken });

      if (response.data.success) {
        const user = response.data.user;
        const token = response.data.token;
        const refreshToken = response.data.refreshToken;
        
        await AsyncStorage.setItem('user', JSON.stringify(user));
        await storeTokenSecurely(token);
        if (refreshToken) {
          await storeRefreshTokenSecurely(refreshToken);
        }
        
        set({ user, token, refreshToken, isLoading: false });
        return { success: true };
      }

      set({ isLoading: false, error: response.data.message });
      return { success: false, message: response.data.message };
    } catch (error: any) {
      console.error('Google Sign In Error:', error);
      if (__DEV__) {
        console.error('Google Sign In Error:', error);
      }
      const msg = error.response?.data?.message || 'Sign in failed';
      set({ isLoading: false, error: msg });
      return { success: false, message: msg };
    }
  },

  sendOTP: async (phone: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(
        `${API_URL}/auth/send-otp`,
        { phone },
        { timeout: 15000 }
      );

      set({ isLoading: false });
      const data = response.data || {};
      const otp = data.otp != null ? String(data.otp) : undefined;
      return {
        success: !!data.success,
        message: data.message,
        isNewUser: data.isNewUser,
        otp
      };
    } catch (error: any) {
      console.error('Send OTP Error:', error?.message, 'URL:', `${API_URL}/auth/send-otp`);

      let msg = 'Failed to send OTP. Please try again.';

      if (error.response) {
        if (error.response.status === 429) {
          msg = error.response.data?.message || 'Too many OTP requests. Please wait 10 minutes and try again.';
        } else if (error.response.status === 400) {
          msg = error.response.data?.message || 'Invalid phone number. Use 10 digits (e.g. 9876543210).';
        } else {
          msg = error.response.data?.message || `Server error (${error.response.status}). Please try again.`;
        }
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        msg = `Request timed out. Trying: ${API_URL}`;
      } else if (error.request) {
        msg = `Cannot reach server at ${API_URL}. Check internet connection.`;
      }

      set({ isLoading: false, error: msg });
      return { success: false, message: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  verifyOTP: async (phone: string, code: string, name?: string, email?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${API_URL}/auth/verify-otp`, {
        phone,
        otp: code,
        name,
        email
      });

      if (response.data.success) {
        const user = response.data.user;
        const token = response.data.token;
        const refreshToken = response.data.refreshToken;
        const isNewUser = response.data.isNewUser;
        
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

      set({ isLoading: false, error: response.data.message });
      return { success: false, message: response.data.message };
    } catch (error: any) {
      if (__DEV__) {
        console.error('Verify OTP Error:', error);
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
    
    // Call backend logout endpoint - must succeed before clearing local data
    await axios.post(`${API_URL}/auth/logout`, {}, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    
    // Only clear local storage if backend logout succeeded
    await clearSecureTokens();
    await AsyncStorage.removeItem('user');
    set({ user: null, token: null, refreshToken: null });
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
      
      if (userStr) {
        set({ 
          user: JSON.parse(userStr), 
          token, 
          refreshToken,
          biometricEnabled: await isBiometricAvailable()
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading user:', error);
      }
    }
  },

  fetchCurrentUser: async () => {
    try {
      const token = await getTokenSecurely();
      if (!token) {
        return { success: false };
      }

      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        const user = response.data.user;
        
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
      } else if (__DEV__) {
        console.error('Error fetching current user:', error);
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
      const response = await axios.post(`${API_URL}/auth/refresh-token`, {
        refreshToken
      });

      if (response.data.success) {
        const { token, refreshToken: newRefreshToken } = response.data;
        await storeTokenSecurely(token);
        if (newRefreshToken) {
          await storeRefreshTokenSecurely(newRefreshToken);
        }
        set({ token, refreshToken: newRefreshToken || refreshToken, isLoading: false });
      }      } catch (error) {
        if (__DEV__) {
          console.error('Token refresh failed:', error);
        }
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
