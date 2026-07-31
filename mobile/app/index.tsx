// app/index.tsx - Home screen (expo-router) - Redirects based on auth state and assessment
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../store/authStore';

const dlog = (...args: any[]) => {
  if (__DEV__) console.log('[index]', ...args);
};

export default function Home() {
  const router = useRouter();
  const [hasChecked, setHasChecked] = useState(false);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuthAndAssessment = async () => {
      try {
        await useAuthStore.getState().loadUser();

        await new Promise(resolve => setTimeout(resolve, 100));

        if (!isMounted) return;

        const currentUser = useAuthStore.getState().user;
        const currentToken = useAuthStore.getState().token;

        dlog('loadUser done — user:', !!currentUser, 'token:', !!currentToken, 'phone:', currentUser?.phone);

        if (!currentUser || !currentToken) {
          dlog('→ /signin');
          setHasChecked(true);
          hasCheckedRef.current = true;
          router.replace('/signin');
          return;
        }

        const serverResult = await useAuthStore.getState().fetchCurrentUser();
        if (!isMounted) return;

        const user = serverResult?.user || currentUser;
        const hasOnboarded = user?.onboardingCompleted || !!user?.phone;
        const assessmentCompleted = user?.assessmentCompleted === true;

        dlog('hasOnboarded:', hasOnboarded, 'assessmentCompleted:', assessmentCompleted);

        setHasChecked(true);
        hasCheckedRef.current = true;

        if (!hasOnboarded) {
          dlog('→ /verify-phone');
          router.replace('/verify-phone');
        } else if (assessmentCompleted) {
          dlog('→ /(home)/menu');
          router.replace('/(home)/menu');
        } else {
          dlog('→ /assessment');
          router.replace('/assessment');
        }
      } catch (_error: any) {
        if (__DEV__) console.error('[index] fetchCurrentUser error:', _error?.message);
        if (isMounted) {
          const currentUser = useAuthStore.getState().user;
          const currentToken = useAuthStore.getState().token;
          setHasChecked(true);
          hasCheckedRef.current = true;
          if (currentUser && currentToken) {
            const hasOnboarded = currentUser?.onboardingCompleted || !!currentUser?.phone;
            if (!hasOnboarded) {
              router.replace('/verify-phone');
            } else {
              router.replace('/assessment');
            }
          } else {
            router.replace('/signin');
          }
        }
      }
    };

    const timeoutId = setTimeout(() => {
      if (!hasCheckedRef.current && isMounted) {
        setHasChecked(true);
        hasCheckedRef.current = true;
        router.replace('/signin');
      }
    }, 5000);

    checkAuthAndAssessment();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  if (!hasChecked) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return null;
}






