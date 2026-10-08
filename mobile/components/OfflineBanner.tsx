import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore } from '../store/networkStore';

/**
 * Thin app-wide banner shown when the device is offline.
 * Rendering it as an absolute overlay keeps it visible above every screen.
 */
export default function OfflineBanner() {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const isInitialized = useNetworkStore((s) => s.isInitialized);
  const insets = useSafeAreaInsets();

  if (!isInitialized || isOnline) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        paddingTop: insets.top,
        backgroundColor: '#B45309',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 6,
        }}
      >
        <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
          {"You're offline — some content may be unavailable"}
        </Text>
      </View>
    </View>
  );
}
