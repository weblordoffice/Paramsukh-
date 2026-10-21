import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import apiClient from '../utils/apiClient';
import { useTheme } from '../hooks/useTheme';

type ReflectionDetail = {
  _id: string;
  title: string;
  prompt: string;
  guidance?: string;
  minWords?: number;
  isCompleted?: boolean;
  submission?: {
    _id: string;
    response: string;
    submittedAt: string;
  } | null;
};

export default function ReflectionViewerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const courseId = String(params.courseId || '');
  const reflectionId = String(params.reflectionId || '');
  const courseColor = String(params.courseColor || colors.primary);
  const paramTitle = String(params.title || 'Reflection');
  const paramPrompt = String(params.prompt || '');
  const paramGuidance = String(params.guidance || '');
  const paramMinWords = Number(params.minWords || 20);

  const [reflection, setReflection] = useState<ReflectionDetail | null>(null);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!courseId || !reflectionId) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiClient.get(`/courses/${courseId}/reflections`);
        const found = (res.data?.reflections || []).find((item: ReflectionDetail) => item._id === reflectionId);
        if (!cancelled && found) {
          setReflection(found);
          setResponse(found.submission?.response || '');
        }
      } catch {
        // Fall back to route params below.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [courseId, reflectionId]);

  const title = reflection?.title || paramTitle;
  const prompt = reflection?.prompt || paramPrompt;
  const guidance = reflection?.guidance || paramGuidance;
  const minWords = reflection?.minWords || paramMinWords;

  const words = useMemo(
    () => response.trim().split(/\s+/).filter(Boolean).length,
    [response]
  );

  const submit = async () => {
    if (!courseId || !reflectionId) return;
    if (words < minWords) {
      Alert.alert('More Detail Needed', `Please write at least ${minWords} words.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post(`/courses/${courseId}/reflections/${reflectionId}/submit`, {
        response: response.trim(),
      });
      if (res.data?.success) {
        setReflection((prev) => prev ? {
          ...prev,
          isCompleted: true,
          submission: res.data.submission,
        } : prev);
        Alert.alert('Reflection Saved', 'Your reflection has been submitted.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Unable to save', error.response?.data?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    closeBtn: { padding: 4 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    content: { padding: 20, paddingBottom: 40 },
    promptCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 16,
    },
    label: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    prompt: { fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 24 },
    guidance: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginTop: 10 },
    input: {
      minHeight: 180,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
      backgroundColor: colors.surface,
      textAlignVertical: 'top',
    },
    wordRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    wordText: { fontSize: 11, color: colors.textSecondary },
    wordOk: { color: colors.success, fontWeight: '700' },
    submittedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(16,185,129,0.10)',
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    submittedText: { flex: 1, fontSize: 12, color: colors.success, fontWeight: '600' },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 14,
      paddingVertical: 15,
      marginTop: 18,
    },
    submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    disabled: { opacity: 0.5 },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.promptCard}>
          <Text style={s.label}>Reflection Prompt</Text>
          <Text style={s.prompt}>{prompt}</Text>
          {!!guidance && <Text style={s.guidance}>{guidance}</Text>}
        </View>

        {reflection?.submission?.response && (
          <View style={s.submittedCard}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={s.submittedText}>
              Submitted {new Date(reflection.submission.submittedAt).toLocaleDateString()}. You can update your response.
            </Text>
          </View>
        )}

        <Text style={s.label}>Your Reflection</Text>
        <TextInput
          style={s.input}
          value={response}
          onChangeText={setResponse}
          placeholder="Write your reflection here..."
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={5000}
        />

        <View style={s.wordRow}>
          <Text style={[s.wordText, words >= minWords && s.wordOk]}>
            {words} / {minWords} words minimum
          </Text>
        </View>

        <TouchableOpacity
          style={[s.submitBtn, { backgroundColor: courseColor }, (submitting || words < minWords) && s.disabled]}
          onPress={submit}
          disabled={submitting || words < minWords}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
              <Text style={s.submitText}>Submit Reflection</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
