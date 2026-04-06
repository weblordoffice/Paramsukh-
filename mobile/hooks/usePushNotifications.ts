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
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

// ─── Android notification channel ─────────────────────────────────────────────
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F1842D',
  }).catch(() => {});
}

// Set foreground notification handler (show alert + badge + sound while app is open)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePushNotifications() {
  const router = useRouter();
  const { token: authToken } = useAuthStore();
  const { registerDeviceToken, fetchUnreadCount } = useNotificationStore();

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Only run when the user is logged in
    if (!authToken) return;

    let cancelled = false;

    const setup = async () => {
      try {
        // Don't try to get a push token on emulators/simulators
        if (!Device.isDevice) {
          console.log('ℹ️ Push notifications disabled on emulator');
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
          console.warn('⚠️  Push notification permission not granted');
          return;
        }

        // Get the Expo push token — projectId ties the token to this specific app
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'b6377463-45af-4c15-b761-627f43d190c8', // from app.json extra.eas.projectId
        });
        const expoPushToken = tokenData?.data;

        if (!expoPushToken || cancelled) return;

        console.log('📱 Got push token, registering with backend...');
        
        // Register with backend (always register on login to ensure fresh token)
        await registerDeviceToken(expoPushToken);

        // ── Listen for notifications received while app is foregrounded ──
        notificationListener.current = Notifications.addNotificationReceivedListener(
          (notification: any) => {
            // Refresh unread badge count when a push arrives
            fetchUnreadCount();
            console.log('📲 Push received in foreground:', notification.request.content.title);
          }
        );

        // ── Listen for notification taps (app in background or from cold start) ──
        responseListener.current = Notifications.addNotificationResponseReceivedListener(
          (response: any) => {
            const data = response?.notification?.request?.content?.data || {};
            handleNotificationTap(data, router);
          }
        );
      } catch (err) {
        console.error('❌ Push setup error:', err);
      }
    };

    setup();

    return () => {
      cancelled = true;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [authToken]); // Re-run when authToken changes (on login/logout)
}

/**
 * Navigate to the correct screen when a user taps a push notification.
 * We use the `actionUrl` or `relatedType` + `relatedId` from the push data.
 */
function handleNotificationTap(data: Record<string, any>, router: any) {
  try {
    if (data.actionUrl) {
      router.push(data.actionUrl);
      return;
    }

    const { relatedType, relatedId } = data;
    if (!relatedType || !relatedId) return;

    switch (relatedType) {
      case 'event':
        router.push({ pathname: '/event-detail', params: { eventId: relatedId } });
        break;
      case 'course':
        router.push({ pathname: '/course-detail', params: { courseId: relatedId } });
        break;
      case 'booking':
        // No /counseling-booking page, so redirect to counseling summary/list if available, 
        // or just stay put if specific booking detail isn't implemented.
        router.push('/counseling');
        break;
      case 'membership':
        router.push('/(home)/my-membership');
        break;
      case 'order':
        router.push({ pathname: '/order-detail', params: { orderId: relatedId } });
        break;
      case 'post':
        router.push({ pathname: '/community-post', params: { postId: relatedId } });
        break;
      default:
        router.push('/(home)/notifications');
    }
  } catch (e) {
    // navigation failures shouldn't crash the app
  }
}
