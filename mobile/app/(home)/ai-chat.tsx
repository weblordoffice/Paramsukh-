import React, { useMemo } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';

import AIChatPanel from '../../components/AIChatPanel';
import { buildAIScreenContext } from '../../utils/aiScreenContext';

export default function AIChatScreen() {
  const params = useGlobalSearchParams();
  const context = useMemo(() => buildAIScreenContext('/ai-chat', params), [params]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AIChatPanel context={context} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF9F2',
  },
});
