import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

/**
 * Returns the total bottom space needed to avoid tab bar overlap
 * Tab bar height (60) + safe area inset + extra padding (16)
 */
export function useBottomTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  
  return useMemo(() => {
    const tabBarHeight = 60; // Matches the tab bar height in _layout.tsx
    const extraPadding = 16; // Extra spacing for better UX
    return tabBarHeight + insets.bottom + extraPadding;
  }, [insets.bottom]);
}
