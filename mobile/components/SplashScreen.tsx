import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, ActivityIndicator } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Fade in and scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide splash screen after 2.5 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, onFinish]);

  return (
    <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}>
      <Animated.View
        className="items-center"
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
      >
        <Image
          source={require('../assets/paramsukh.png')}
          className="w-[300px] h-[300px]"
          resizeMode="contain"
        />
        <ActivityIndicator
          size="large"
          color={colors.primary}
          className="mt-8"
        />
      </Animated.View>
    </View>
  );
}
