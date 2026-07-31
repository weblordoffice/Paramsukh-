import { Stack, usePathname, useRouter } from 'expo-router';
import './global.css';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useEffect, useMemo, useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { setClerkSignOut } from '../store/authStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import AIAssistantWidget from '../components/AIAssistantWidget';
import { ClerkProvider, useUser, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const dlog = (...args: any[]) => {
  if (__DEV__) console.log('[AuthGuard]', ...args);
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, token, syncClerkUser, fetchCurrentUser } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const isAuthRoute = useMemo(
    () => pathname === '/signin' || pathname === '/signup',
    [pathname]
  );
  const isOnboardingRoute = useMemo(
    () => isAuthRoute || pathname === '/verify-phone' || pathname === '/assessment' || pathname === '/',
    [isAuthRoute, pathname]
  );

  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { getToken, signOut: clerkSignOut } = useAuth();

  useEffect(() => {
    setClerkSignOut(clerkSignOut);
  }, [clerkSignOut]);

  // Effect 1: Clerk → Backend sync (runs when Clerk user exists but no backend session)
  useEffect(() => {
    if (!isClerkLoaded || !clerkUser) return;
    if (user && token) return;

    dlog('Effect1: syncing Clerk user — email:', clerkUser.primaryEmailAddress?.emailAddress);

    let cancelled = false;
    setIsSyncing(true);

    const performSync = async () => {
      try {
        const clerkToken = await getToken();
        const pendingReferralCode = await AsyncStorage.getItem('pending_referral_code');
        if (pendingReferralCode) {
          await AsyncStorage.removeItem('pending_referral_code');
        }
        const result = await syncClerkUser({
          clerkId: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress,
          displayName: clerkUser.fullName || clerkUser.firstName || 'Gurukul Member',
          photoURL: clerkUser.imageUrl,
          clerkToken: clerkToken || undefined,
          referralCode: pendingReferralCode || undefined
        });
        if (!cancelled && !result?.success) {
          dlog('Effect1: sync failed, redirecting to signin');
          await clerkSignOut();
          router.replace('/signin');
        }
        dlog('Effect1: sync complete — success:', result?.success);
      } catch (err) {
        console.error('[AuthGuard] Clerk sync error:', err);
        if (!cancelled) {
          await clerkSignOut();
          router.replace('/signin');
        }
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    };
    performSync();

    return () => { cancelled = true; };
  }, [clerkUser, isClerkLoaded]);

  // Effect 2: Fetch latest user data when session is authenticated
  useEffect(() => {
    if (user && token && user.phone && !isSyncing) {
      fetchCurrentUser();
    }
  }, [user?._id, !!token, isSyncing]);

  // Effect 3: Route guard — enforces auth-based navigation
  useEffect(() => {
    if (!isClerkLoaded || isSyncing) return;

    // No session: redirect to signin (unless already on an auth route)
    if (!user || !token) {
      dlog('Effect3: no session — pathname:', pathname, 'isAuthRoute:', isAuthRoute);
      if (!isAuthRoute) {
        router.replace('/signin');
      }
      return;
    }

    const hasOnboarded = user.onboardingCompleted || !!user.phone;

    dlog('Effect3:', {
      phone: user.phone,
      onboardingCompleted: user.onboardingCompleted,
      hasOnboarded,
      assessmentCompleted: user.assessmentCompleted,
      pathname,
      isAuthRoute
    });

    // Authenticated + onboarded on auth route → redirect forward
    if (hasOnboarded && isAuthRoute) {
      dlog('Effect3: → / (onboarded auth route)');
      router.replace('/');
      return;
    }

    // Onboarded user on verify-phone → go home
    if (hasOnboarded && pathname === '/verify-phone') {
      dlog('Effect3: → / (onboarded on verify-phone)');
      router.replace('/');
      return;
    }

    // Not onboarded and not already on verify-phone → go there
    if (!hasOnboarded && pathname !== '/verify-phone') {
      dlog('Effect3: → /verify-phone');
      router.replace('/verify-phone');
      return;
    }

    // Onboarded but no assessment → go to assessment
    if (hasOnboarded && !user.assessmentCompleted && !isOnboardingRoute) {
      dlog('Effect3: → /assessment');
      router.replace('/assessment');
      return;
    }
  }, [user, token, isAuthRoute, isOnboardingRoute, pathname, isClerkLoaded, isSyncing]);

  // ── Render-phase guards (prevent UI flash during redirects) ──

  if (!isClerkLoaded || isSyncing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#F1842D" />
      </View>
    );
  }

  if ((!user || !token) && !isAuthRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#F1842D" />
      </View>
    );
  }

  const hasOnboarded = user?.onboardingCompleted || !!user?.phone;

  if (user && token && hasOnboarded && isAuthRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#F1842D" />
      </View>
    );
  }

  if (user && !hasOnboarded && pathname !== '/verify-phone') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#F1842D" />
      </View>
    );
  }

  if (user && hasOnboarded && !user.assessmentCompleted && !isOnboardingRoute) {
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
