import { create } from 'zustand';
import { Platform } from 'react-native';
import apiClient from '../utils/apiClient';
import { API_URL } from '../config/api';

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
    set({ isLoading: true, error: null });
    try {
      const { page = 1, limit = 50, unreadOnly = false } = params;
      const query = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (unreadOnly) query.set('unreadOnly', 'true');

      const response = await apiClient.get(`${API_URL}/notifications?${query.toString()}`);

      if (response.data?.success && response.data?.data) {
        const { notifications, unreadCount } = response.data?.data || {};
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
    try {
      const response = await apiClient.get(`${API_URL}/notifications/unread-count`);
      if (response.data?.success && response.data?.data?.unreadCount !== undefined) {
        const count = response.data?.data?.unreadCount;
        set({ unreadCount: count });
        return count;
      }
    } catch (e) {
    }
    return get().unreadCount;
  },

  markAsRead: async (id: string) => {
    try {
      const response = await apiClient.patch(`${API_URL}/notifications/${id}/read`);
      if (response.data?.success) {
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
    try {
      const response = await apiClient.patch(`${API_URL}/notifications/read-all`);
      if (response.data?.success) {
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
    try {
      const response = await apiClient.delete(`${API_URL}/notifications/${id}`);
      if (response.data?.success) {
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
    if (!expoPushToken) {
      return false;
    }

    try {
      const response = await apiClient.post(
        `${API_URL}/notifications/device-token`,
        { token: expoPushToken, platform: Platform.OS },
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
