import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

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
    /** Exchange Google id_token or access_token for backend JWT. Call after NextAuth sign-in. */
    exchangeGoogleToken: (tokens: { idToken?: string; accessToken?: string }) => Promise<LoginResult>;
    logout: () => void;
    hasPermission: (permission: string) => boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';

export type LoginResult = { ok: true } | { ok: false; message: string };

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            isAuthenticated: false,
            user: null,
            token: null,

            exchangeGoogleToken: async (tokens: { idToken?: string; accessToken?: string }): Promise<LoginResult> => {
                try {
                    const response = await axios.post(
                        `${API_URL}/api/admin/auth/google`,
                        { idToken: tokens.idToken, accessToken: tokens.accessToken },
                        { timeout: 15000 }
                    );

                    if (response.data.success) {
                        const { token, admin } = response.data;
                        set({
                            isAuthenticated: true,
                            user: admin,
                            token,
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
                set({ isAuthenticated: false, user: null, token: null });
                delete axios.defaults.headers.common['Authorization'];
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
