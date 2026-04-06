import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { API_BASE_URL } from '@/lib/api/config';

interface AdminUser {
    _id: string;
    name: string;
    email: string;
    role: 'super_admin' | 'admin';
    permissions: string[];
}

interface AuthState {
    isAuthenticated: boolean;
    user: AdminUser | null;
    token: string | null;
    refreshToken: string | null;
    tokenExpiry: number | null; // Timestamp when token expires
    /** Exchange Google id_token or access_token for backend JWT. Call after NextAuth sign-in. */
    exchangeGoogleToken: (tokens: { idToken?: string; accessToken?: string }) => Promise<LoginResult>;
    /** Refresh the current token if it's expiring soon */
    refreshTokenIfNeeded: () => Promise<boolean>;
    logout: () => void;
    hasPermission: (permission: string) => boolean;
}

export type LoginResult = { ok: true } | { ok: false; message: string };

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            isAuthenticated: false,
            user: null,
            token: null,
            refreshToken: null,
            tokenExpiry: null,

            exchangeGoogleToken: async (tokens: { idToken?: string; accessToken?: string }): Promise<LoginResult> => {
                try {
                    console.log('[Admin Auth] Calling backend:', `${API_BASE_URL}/api/admin/auth/google`);
                    console.log('[Admin Auth] Has idToken:', !!tokens.idToken, '| Has accessToken:', !!tokens.accessToken);
                    const response = await axios.post(
                        `${API_BASE_URL}/api/admin/auth/google`,
                        { idToken: tokens.idToken, accessToken: tokens.accessToken },
                        { timeout: 15000 }
                    );

                    if (response.data.success) {
                        const { token, admin, refreshToken, expiresIn } = response.data;
                        const expiryTime = Date.now() + (expiresIn || 7 * 24 * 60 * 60 * 1000); // 7 days default
                        set({
                            isAuthenticated: true,
                            user: admin,
                            token,
                            refreshToken: refreshToken || null,
                            tokenExpiry: expiryTime,
                        });
                        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                        return { ok: true };
                    }
                    return { ok: false, message: response.data?.message || 'Not an admin' };
                } catch (error: unknown) {
                    const err = error as { response?: { data?: { message?: string }; status?: number }; message?: string };
                    const msg =
                        err?.response?.data?.message ||
                        err?.message ||
                        (err?.response?.status === 403
                            ? 'This account is not an admin. Ask a super admin to add your email in Settings.'
                            : 'Could not sign in.');
                    return { ok: false, message: msg };
                }
            },

            logout: () => {
                set({ isAuthenticated: false, user: null, token: null, refreshToken: null, tokenExpiry: null });
                delete axios.defaults.headers.common['Authorization'];
            },

            refreshTokenIfNeeded: async () => {
                const { token, tokenExpiry, refreshToken: storedRefreshToken } = get();

                // No token at all - nothing to refresh
                if (!token) return false;

                // Token still valid for 5+ minutes and we have expiry info - no refresh needed
                if (tokenExpiry && Date.now() < tokenExpiry - 5 * 60 * 1000) return true;

                // If no refresh token, can't refresh
                if (!storedRefreshToken) {
                    console.warn('⚠️ Token expired but no refresh token available - must re-login');
                    get().logout();
                    return false;
                }

                try {
                    console.log('🔄 Refreshing admin token...');
                    const response = await axios.post(
                        `${API_BASE_URL}/api/admin/refresh-token`,
                        { refreshToken: storedRefreshToken },
                        { timeout: 10000 }
                    );

                    if (response.data.success) {
                        const { token: newToken, refreshToken: newRefreshToken, admin, expiresIn } = response.data;
                        const expiryTime = Date.now() + (expiresIn || 24 * 60 * 60 * 1000);
                        set({
                            token: newToken,
                            refreshToken: newRefreshToken || storedRefreshToken,
                            user: admin,
                            tokenExpiry: expiryTime,
                        });
                        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                        console.log('✅ Token refreshed successfully');
                        return true;
                    }
                    get().logout();
                    return false;
                } catch (error) {
                    console.error('❌ Token refresh failed:', error);
                    get().logout();
                    return false;
                }
            },

            hasPermission: (permission: string) => {
                const { user } = get();
                if (!user) return false;
                if (user.role === 'super_admin') return true;
                return (user.permissions || []).includes(permission);
            },
        }),
        { name: 'admin-auth-storage' }
    )
);
