import axios from 'axios';
import { useAuthStore } from '@/lib/store/authStore';
import { API_BASE_URL } from './config';

const isProduction = process.env.NODE_ENV === 'production';
const ADMIN_API_KEY =
    process.env.NEXT_PUBLIC_ADMIN_API_KEY ||
    (isProduction ? '' : 'dev-admin-key-123');

if (isProduction && !ADMIN_API_KEY) {
    console.error(
        'NEXT_PUBLIC_ADMIN_API_KEY is missing in production build. Set it before building the admin app.'
    );
}

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': ADMIN_API_KEY,
    },
});

// Request interceptor: add admin JWT, and let browser set Content-Type for FormData
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
            const url = error.config?.url || 'unknown';

            // Handle 401 Unauthorized (token expired)
            if (status === 401 && !originalRequest._retry) {
                if (isRefreshing) {
                    // If already refreshing, queue this request
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
                    // Try to refresh token
                    const { useAuthStore } = await import('@/lib/store/authStore');
                    const refreshed = await useAuthStore.getState().refreshTokenIfNeeded();

                    if (refreshed) {
                        const newToken = useAuthStore.getState().token;
                        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                        processQueue(null, newToken);
                        return apiClient(originalRequest);
                    } else {
                        // Refresh failed - store already called logout, go to home/login page
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

            // Only log non-404 errors (404s are expected when data doesn't exist yet)
            if (status !== 404 && status !== 401) {
                console.error(`API Error [${status}] ${url}:`, error.response?.data || error.message);
            }
        } else if (error.request) {
            // Request made but no response (network error/backend not running)
            console.error('Network Error: Backend server may not be running at', API_BASE_URL);
            console.error('  → Local: Start the backend (e.g. in backend folder: npm run dev).');
            console.error('  → Production: Set NEXT_PUBLIC_API_URL to your API URL and rebuild.');
        } else {
            console.error('Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default apiClient;
