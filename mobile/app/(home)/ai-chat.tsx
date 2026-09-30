import React, { useMemo } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';

import AIChatPanel from '../../components/AIChatPanel';
import { buildAIScreenContext } from '../../utils/aiScreenContext';
import { useTheme } from '../../hooks/useTheme';

export default function AIChatScreen() {
  const { colors } = useTheme();
  const params = useGlobalSearchParams();
  const context = useMemo(() => buildAIScreenContext('/ai-chat', params), [params]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <AIChatPanel context={context} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
});
