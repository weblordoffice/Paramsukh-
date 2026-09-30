/**
 * usePushNotifications.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Custom hook that:
 *  1. Requests push notification permission on first run
 *  2. Gets the Expo Push Token
 *  3. Registers the token with the backend via notificationStore
 *  4. Sets up a listener so notifications received while app is open
 *     show a banner and update the unread count
 *  5. Handles deep-link navigation when user taps a notification
 *
 * Usage (call once in _layout.tsx or app root):
 *   usePushNotifications();
 *
 * Requirements:
 *   npx expo install expo-notifications expo-device
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router as appRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { resolveNotificationRoute } from '../utils/notificationNavigation';

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePushNotifications() {
  const { token: authToken } = useAuthStore();
  const { registerDeviceToken, fetchUnreadCount, markAsRead } = useNotificationStore();
  const isExpoGo = Constants.appOwnership === 'expo';

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
           
  useEffect(() => {
    // Only run when the user is logged in
    if (!authToken) return;
    if (isExpoGo) {
      return;
    }

    let cancelled = false;

    const setup = async () => {
      try {
        const Notifications = await import('expo-notifications');
        const Device = await import('expo-device');

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#F1842D',
          }).catch(() => {});
        }

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        // Don't try to get a push token on emulators/simulators
        if (!Device.isDevice) {
          return;
        }

        // Request permission
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          return;
        }

        // Get the Expo push token — projectId ties the token to this specific app
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) return;

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        const expoPushToken = tokenData?.data;

        if (!expoPushToken || cancelled) return;

        // Register with backend (always register on login to ensure fresh token)
        await registerDeviceToken(expoPushToken);

        // ── Listen for notifications received while app is foregrounded ──
        notificationListener.current = Notifications.addNotificationReceivedListener(
          (notification: any) => {
            // Refresh unread badge count when a push arrives
            fetchUnreadCount();
          }
        );

        // ── Listen for notification taps (app in background or from cold start) ──
        responseListener.current = Notifications.addNotificationResponseReceivedListener(
          (response: any) => {
            const data = response?.notification?.request?.content?.data || {};
            handleNotificationTap(data, { markAsRead, fetchUnreadCount });
          }
        );

        // Cold-start: app launched by tapping a notification before listeners mounted
        try {
          const lastResponse = await Notifications.getLastNotificationResponseAsync();
          const coldData = (lastResponse as any)?.notification?.request?.content?.data;
          if (coldData && (coldData.notificationId || coldData.relatedId || coldData.actionUrl)) {
            handleNotificationTap(coldData, { markAsRead, fetchUnreadCount });
          }
        } catch {}
      } catch (err) {
      }
    };

    setup();    

    return () => {
      cancelled = true;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [authToken, isExpoGo, registerDeviceToken, fetchUnreadCount, markAsRead]); // Re-run when authToken changes (on login/logout)
}

/**
 * Navigate to the correct screen when a user taps a push notification.
 * Uses the shared allow-listed resolver so push taps and in-app taps agree,
 * with a safe fallback to the notifications list (never a 404).
 */
function handleNotificationTap(
  data: Record<string, any>,
  store?: { markAsRead?: (id: string) => Promise<boolean>; fetchUnreadCount?: () => Promise<number> },
) {
  try {
    // Mark exactly this notification read (backend includes notificationId in push data)
    if (data.notificationId && store?.markAsRead) {
      store.markAsRead(String(data.notificationId)).catch(() => {});
    } else if (store?.fetchUnreadCount) {
      store.fetchUnreadCount().catch(() => {});
    }
    const destination = resolveNotificationRoute({
      type: data.type,
      actionUrl: data.actionUrl ?? null,
      relatedType: data.relatedType ?? null,
      relatedId: data.relatedId ? String(data.relatedId) : null,
    });
    appRouter.push(destination as any);
  } catch (e) {
    // navigation failures shouldn't crash the app — fall back to the list
    try {
      appRouter.push('/(home)/notifications' as any);
    } catch {}
  }
}
