import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuthStore } from './authStore';

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  icon?: string;
  createdAt: string;
  readAt?: string;
  actionUrl?: string;
  relatedId?: string;
  relatedType?: string;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  deviceTokenRegistered: boolean;

  fetchNotifications: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) => Promise<void>;
  fetchUnreadCount: () => Promise<number>;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  deleteNotification: (id: string) => Promise<boolean>;
  registerDeviceToken: (expoPushToken: string) => Promise<boolean>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  deviceTokenRegistered: false,

  fetchNotifications: async (params = {}) => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ notifications: [], isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { page = 1, limit = 50, unreadOnly = false } = params;
      const query = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (unreadOnly) query.set('unreadOnly', 'true');

      const response = await axios.get(`${API_URL}/notifications?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success && response.data.data) {
        const { notifications, unreadCount } = response.data.data;
        set({
          notifications: notifications || [],
          unreadCount: unreadCount ?? 0,
          isLoading: false,
          error: null,
        });
      } else {
        set({ notifications: [], isLoading: false });
      }
    } catch (error: unknown) {
      set({
        notifications: [],
        isLoading: false,
        error: (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load notifications',
      });
    }
  },

  fetchUnreadCount: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return 0;

    try {
      const response = await axios.get(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success && response.data.data?.unreadCount !== undefined) {
        const count = response.data.data.unreadCount;
        set({ unreadCount: count });
        return count;
      }
    } catch (e) {
    }
    return get().unreadCount;
  },

  markAsRead: async (id: string) => {
    const token = useAuthStore.getState().token;
    if (!token) return false;

    try {
      const response = await axios.patch(`${API_URL}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n._id === id ? { ...n, isRead: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
        return true;
      }
    } catch (e) {
    }
    return false;
  },

  markAllAsRead: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return false;

    try {
      const response = await axios.patch(`${API_URL}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        }));
        return true;
      }
    } catch (e) {
    }
    return false;
  },

  deleteNotification: async (id: string) => {
    const token = useAuthStore.getState().token;
    if (!token) return false;

    try {
      const response = await axios.delete(`${API_URL}/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        const notif = get().notifications.find((n) => n._id === id);
        set((state) => ({
          notifications: state.notifications.filter((n) => n._id !== id),
          unreadCount: notif && !notif.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        }));
        return true;
      }
    } catch (e) {
    }
    return false;
  },

  registerDeviceToken: async (expoPushToken: string) => {
    // Always register on login (don't skip even if already registered this session)
    // This ensures token is updated when user logs in on a new device or after token refresh
    const token = useAuthStore.getState().token;
    if (!token || !expoPushToken) {
      return false;
    }

    try {
      const response = await axios.post(
        `${API_URL}/notifications/device-token`,
        { token: expoPushToken, platform: 'android' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data?.success) {
        set({ deviceTokenRegistered: true });
        return true;
      }
    } catch (e: any) {
    }
    return false;
  },
}));
