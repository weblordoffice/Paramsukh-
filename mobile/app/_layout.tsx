import { Stack, usePathname, useRouter } from 'expo-router';
import './global.css';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import AIAssistantWidget from '../components/AIAssistantWidget';
import { ClerkProvider, useUser, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';

const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch (error) {
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

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
      <Stack.Screen name="verify-phone" />
      <Stack.Screen name="counseling" />
      <Stack.Screen name="book-counseling" />
      <Stack.Screen name="blogs" />
      <Stack.Screen name="blog-detail" />
    </Stack>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, token, syncClerkUser } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [hasRedirected, setHasRedirected] = useState(false);
  const isAuthRoute = useMemo(
    () => pathname === '/signin' || pathname === '/signup',
    [pathname]
  );

  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    if (isClerkLoaded && clerkUser && (!user || !token)) {
      // Sync Clerk user with backend database, passing Clerk session token for verification
      const performSync = async () => {
        const clerkToken = await getToken();
        await syncClerkUser({
          clerkId: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress,
          displayName: clerkUser.fullName || clerkUser.firstName || 'Gurukul Member',
          photoURL: clerkUser.imageUrl,
          clerkToken: clerkToken || undefined
        });
      };
      performSync();
      return;
    }

    if (!user || !token) {
      if (!isAuthRoute) {
        router.replace('/signin');
        setHasRedirected(true);
        return;
      }
    } else {
      // User is logged in. Check if they have verified their phone number.
      if (!user.phone) {
        if (pathname !== '/verify-phone') {
          router.replace('/verify-phone');
          setHasRedirected(true);
          return;
        }
      } else {
        // Linked user trying to access verification screen should go home
        if (pathname === '/verify-phone') {
          router.replace('/');
          setHasRedirected(true);
          return;
        }
      }
    }
    setHasRedirected(false);
  }, [user, token, isAuthRoute, pathname, router, clerkUser, isClerkLoaded]);

  if (!user || !token) {
    if (isAuthRoute) {
      return <>{children}</>;
    }

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#F1842D" />
      </View>
    );
  }

  // Enforce phone verification block before rendering children
  if (!user.phone && pathname !== '/verify-phone') {
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

  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthGuard>
        <View style={{ flex: 1 }}>
          <ErrorBoundary>
            <RootNavigator />
          </ErrorBoundary>
          <AIAssistantWidget />
        </View>
      </AuthGuard>
    </ClerkProvider>
  );
}
