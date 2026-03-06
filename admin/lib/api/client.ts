import axios from 'axios';
import { useAuthStore } from '@/lib/store/authStore';
import { API_BASE_URL } from './config';

const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || 'dev-admin-key-123';

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
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            // Server responded with error status
            const status = error.response.status;
            const url = error.config?.url || 'unknown';

            // Only log non-404 errors (404s are expected when data doesn't exist yet)
            if (status !== 404) {
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
