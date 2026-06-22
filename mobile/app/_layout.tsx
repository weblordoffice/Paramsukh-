import { Stack, useRouter, useSegments } from 'expo-router';
import './global.css';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { ErrorBoundary } from '../components/ErrorBoundary';

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
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!segments || !segments.length) return;

    const isAuthRoute = segments[0] === 'signin' || segments[0] === 'signup';
    
    if (!user || !token) {
      if (!isAuthRoute) {
        router.replace('/signin');
        return;
      }
    }
    setIsChecking(false);
  }, [user, token, segments, router]);

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#F1842D" />
      </View>
    );
  }

  return <>{children}</>;
}

// Expo Router already provides the top-level NavigationContainer.
export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function initAuth() {
      await useAuthStore.getState().loadUser();
      setIsReady(true);
    }
    initAuth();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#F1842D" />
      </View>
    );
  }

  return (
    <AuthGuard>
      <ErrorBoundary>
        <RootNavigator />
      </ErrorBoundary>
    </AuthGuard>
  );
}
