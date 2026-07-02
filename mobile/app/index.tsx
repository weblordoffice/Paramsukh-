// app/index.tsx - Home screen (expo-router) - Redirects based on auth state and assessment
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
                            
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

        if (!currentUser || !currentToken) {
          setHasChecked(true);
          hasCheckedRef.current = true;
          router.replace('/signin');
          return;
        }

        const assessmentCompleted = await AsyncStorage.getItem('assessment_completed');
        if (!isMounted) return;

        setHasChecked(true);
        hasCheckedRef.current = true;
        if (assessmentCompleted === 'true') {
          router.replace('/(home)/menu');
        } else {
          router.replace('/assessment');
        }
      } catch (error: any) {
        if (isMounted) {
          setHasChecked(true);
          hasCheckedRef.current = true;
          router.replace('/signin');
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






