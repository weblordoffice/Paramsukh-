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

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePushNotifications() {
  const { token: authToken } = useAuthStore();
  const { registerDeviceToken, fetchUnreadCount } = useNotificationStore();
  const executionEnvironment = (Constants as any).executionEnvironment;
  const isExpoGo =
    Constants.appOwnership === 'expo' ||
    executionEnvironment === 'storeClient';

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // Only run when the user is logged in
    if (!authToken) return;
    if (false || isExpoGo) {
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
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'b6377463-45af-4c15-b761-627f43d190c8', // from app.json extra.eas.projectId
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
            handleNotificationTap(data);
          }
        );
      } catch (err) {
      }
    };

    setup();

    return () => {
      cancelled = true;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [authToken, isExpoGo, registerDeviceToken, fetchUnreadCount]); // Re-run when authToken changes (on login/logout)
}

/**
 * Navigate to the correct screen when a user taps a push notification.
 * We use the `actionUrl` or `relatedType` + `relatedId` from the push data.
 */
function handleNotificationTap(data: Record<string, any>) {
  try {
    if (data.actionUrl) {
      appRouter.push(data.actionUrl);
      return;
    }

    const { relatedType, relatedId } = data;
    if (!relatedType || !relatedId) return;

    switch (relatedType) {
      case 'event':
        appRouter.push({ pathname: '/event-detail', params: { eventId: relatedId } });
        break;
      case 'course':
        appRouter.push({ pathname: '/course-detail', params: { courseId: relatedId } });
        break;
      case 'booking':
        // No /counseling-booking page, so redirect to counseling summary/list if available, 
        // or just stay put if specific booking detail isn't implemented.
        appRouter.push('/counseling');
        break;
      case 'membership':
        appRouter.push('/(home)/my-membership');
        break;
      case 'support':
        appRouter.push('/(home)/help-support');
        break;
      case 'order':
        appRouter.push({ pathname: '/order-detail', params: { orderId: relatedId } });
        break;
      case 'post':
        appRouter.push('/(home)/community');
        break;
      default:
        appRouter.push('/(home)/notifications');
    }
  } catch (e) {
    // navigation failures shouldn't crash the app
  }
}
