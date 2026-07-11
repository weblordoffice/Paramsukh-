import { Stack, usePathname, useRouter } from 'expo-router';
import './global.css';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import AIAssistantWidget from '../components/AIAssistantWidget';

/**
 * Renders AFTER splash is done. Returns the Stack navigator directly
 * (no Fragment wrapper - Expo Router requires a single navigator root).
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
      <Stack.Screen name="blogs" />
      <Stack.Screen name="blog-detail" />
    </Stack>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [hasRedirected, setHasRedirected] = useState(false);
  const isAuthRoute = useMemo(
    () => pathname === '/signin' || pathname === '/signup',
    [pathname]
  );

  useEffect(() => {
    if (!user || !token) {
      if (!isAuthRoute) {
        router.replace('/signin');
        setHasRedirected(true);
        return;
      }
    }
    setHasRedirected(false);
  }, [user, token, isAuthRoute, router]);

  if (!user || !token) {
    if (isAuthRoute) {
      return <>{children}</>;
    }

    if (hasRedirected) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
          <ActivityIndicator size="large" color="#F1842D" />
        </View>
      );
    }

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
      <View style={{ flex: 1 }}>
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
        <AIAssistantWidget />
      </View>
    </AuthGuard>
  );
}
