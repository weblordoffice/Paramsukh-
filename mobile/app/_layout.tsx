import { Stack } from 'expo-router';
import './global.css';
import { usePushNotifications } from '../hooks/usePushNotifications';

/**
 * Renders AFTER splash is done. Returns the Stack navigator directly
 * (no Fragment wrapper — Expo Router requires a single navigator root).
 * usePushNotifications runs safely here because the navigation tree
 * is already established by Expo Router above this component.
 */
function RootNavigator() {
  usePushNotifications();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(home)" />
      <Stack.Screen name="counseling" />
      <Stack.Screen name="book-counseling" />
    </Stack>
  );
}

// Expo Router already provides the top-level NavigationContainer.
export default function RootLayout() {
  return <RootNavigator />;
}
