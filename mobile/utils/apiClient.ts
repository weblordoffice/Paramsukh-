import axios from 'axios';
import { API_URL } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { getTokenSecurely, getRefreshTokenSecurely, storeTokenSecurely, storeRefreshTokenSecurely, clearSecureTokens } from './biometricAuth';

import { getDeviceDetailsMobile } from './deviceInfo';

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom: any) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token & device identity
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getTokenSecurely();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const device = await getDeviceDetailsMobile();
      config.headers['x-device-id'] = device.deviceId;
      config.headers['x-device-name'] = device.deviceName;
      config.headers['x-device-os'] = device.os;
      config.headers['x-device-browser'] = device.browser;
    } catch (e) {
      console.warn('Failed to inject device headers:', e);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (error.response.data?.code === 'SESSION_REVOKED') {
        await clearSecureTokens();
        await AsyncStorage.multiRemove(['token', 'refreshToken', 'user', 'assessment_completed']);
        useAuthStore.setState({ user: null, token: null, refreshToken: null });
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshTokenSecurely();
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(`${API_URL}/auth/refresh-token`, {
          refreshToken,
        });

        if (response.data?.success) {
          const { token, refreshToken: newRefreshToken } = response.data || {};
          
          if (token) {
            await storeTokenSecurely(token);
          }
          if (newRefreshToken) {
            await storeRefreshTokenSecurely(newRefreshToken);
          }

          processQueue(null, token);
          
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Refresh failed - clear all tokens and user data silently
        await clearSecureTokens();
        await AsyncStorage.multiRemove(['token', 'refreshToken', 'user', 'assessment_completed']);
        
        // Clear auth state without calling backend (token is invalid)
        useAuthStore.setState({ user: null, token: null, refreshToken: null });
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
