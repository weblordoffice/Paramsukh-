// app/index.tsx - Home screen (expo-router) - Redirects based on auth state and assessment
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
                            
export default function Home() {
  const router = useRouter();
  const { user, isLoading, loadUser, fetchCurrentUser } = useAuthStore();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuthAndAssessment = async () => {
      try {
        // First, try to load user from storage (fast initial load)
        await loadUser();

        // Small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!isMounted) return;

        // Get the current user state after loading
        const currentUser = useAuthStore.getState().user;
        const currentToken = useAuthStore.getState().token;

        // If no user, redirect to signin
        if (!currentUser) {
          setHasChecked(true);
          router.replace('/signin');
          return;
        }

        // If we have a token, fetch fresh user data from server
        if (currentToken) {
          const fetchOk = await fetchCurrentUser();
          if (!isMounted) return;
          // If /auth/me failed (401/400/403), we cleared user in store - go to signin
          if (!fetchOk && !useAuthStore.getState().user) {
            setHasChecked(true);
            router.replace('/signin');
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 50));
          if (!isMounted) return;
        }

        // Check if assessment is completed
        const assessmentCompleted = await AsyncStorage.getItem('assessment_completed');
        
        if (!isMounted) return;
        
        setHasChecked(true);
        if (assessmentCompleted === 'true') {
          router.replace('/(home)/menu');
        } else {
          router.replace('/assessment');
        }
      } catch (error: any) {
        // Only log unexpected errors (not auth failures)
        if (error.response?.status !== 401 && __DEV__) {
          console.error('Error checking auth/assessment:', error);
        }
        if (isMounted) {
          setHasChecked(true);
          router.replace('/signin');
        }
      }
    };

    // Timeout fallback - if still loading after 5s, redirect to signin (avoids stuck spinner)
    const timeoutId = setTimeout(() => {
      if (!hasChecked && isMounted) {
        setHasChecked(true);
        router.replace('/signin');
      }
    }, 5000);

    // Only run once on mount
    if (!hasChecked) {
      checkAuthAndAssessment();
    }

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [router, hasChecked, loadUser, fetchCurrentUser]);

  // Show loading screen while checking
  if (!hasChecked) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Return null while redirecting
  return null;
}







