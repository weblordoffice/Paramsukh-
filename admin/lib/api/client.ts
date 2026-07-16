import axios from 'axios';
import { useAuthStore } from '@/lib/store/authStore';
import { API_BASE_URL } from './config';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor: add admin JWT
apiClient.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response) {
            const status = error.response.status;

            if (status === 401 && !originalRequest._retry) {
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    })
                        .then((token) => {
                            originalRequest.headers['Authorization'] = `Bearer ${token}`;
                            return apiClient(originalRequest);
                        })
                        .catch((err) => {
                            return Promise.reject(err);
                        });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const { useAuthStore } = await import('@/lib/store/authStore');
                    const refreshed = await useAuthStore.getState().refreshTokenIfNeeded();

                    if (refreshed) {
                        const newToken = useAuthStore.getState().token;
                        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                        processQueue(null, newToken);
                        return apiClient(originalRequest);
                    } else {
                        processQueue(error, null);
                        window.location.href = '/';
                        return Promise.reject(error);
                    }
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    window.location.href = '/';
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
