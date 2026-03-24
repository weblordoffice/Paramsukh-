import { Stack } from 'expo-router';
import { useState } from 'react';
import './global.css';
import SplashScreen from './SplashScreen';
import { usePushNotifications } from '../hooks/usePushNotifications';

// Expo Router already provides the top-level NavigationContainer.
export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  // Set up push notifications (requests permission, gets token, registers with backend)
  usePushNotifications();

  if (!isReady) {
    return <SplashScreen onFinish={() => setIsReady(true)} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}



