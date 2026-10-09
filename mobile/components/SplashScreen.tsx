import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  // Size the emblem relative to the screen: ~45% of the width, clamped so it
  // never looks oversized on large phones or tiny on small ones.
  const logoSize = Math.max(140, Math.min(Math.round(screenWidth * 0.45), 220));
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
          source={require('../assets/images/logo-n-splash.png')}
          style={{ width: logoSize, height: logoSize }}
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
