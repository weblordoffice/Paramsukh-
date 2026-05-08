import { Stack, useRouter, useSegments } from 'expo-router';
import './global.css';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';

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

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Avoid redirecting if the app is still mounting or there are no segments yet
    if (!segments || segments.length === 0) return;

    const isAuthRoute = segments[0] === 'signin' || segments[0] === 'signup';
    
    if (!user || !token) {
      // User is not logged in
      if (!isAuthRoute) {
        router.replace('/signin');
      }
    }
  }, [user, token, segments, router]);

  return <>{children}</>;
}

// Expo Router already provides the top-level NavigationContainer.
export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { loadUser } = useAuthStore();

  useEffect(() => {
    async function initAuth() {
      await loadUser();
      setIsReady(true);
    }
    initAuth();
  }, [loadUser]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#F1842D" />
      </View>
    );
  }

  return (
    <AuthGuard>
      <RootNavigator />
    </AuthGuard>
  );
}
