import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCourseStore } from '../store/courseStore';
import { useTheme } from '../hooks/useTheme';
import apiClient from '../utils/apiClient';

export default function AssignmentViewerScreen() {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  scrollContent: {
    padding: 20,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  questionHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  qNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  qNumText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  optionText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.surfaceSecondary,
  },
  textCorrect: {
    color: colors.success,
    fontWeight: '600',
  },
  optionWrong: {
    borderColor: colors.danger,
    backgroundColor: colors.surfaceSecondary,
  },
  textWrong: {
    color: colors.danger,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  checkBtn: {
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  explanationBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  expTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  expText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  resultCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  resultScore: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  resultMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  finishBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  finishBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.text,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.background,
    fontWeight: '600',
  }
});
  const router = useRouter();
  const params = useLocalSearchParams();
  const { currentCourse } = useCourseStore();

  const assignmentId = params.assignmentId as string;
  const courseId = params.courseId as string;
  const courseColor = (params.courseColor as string) || '#8B5CF6';

  // Find the assignment in the current course
  const assignment = currentCourse?.assignments?.find(a => a._id === assignmentId) || 
                     currentCourse?.videos?.flatMap(v => v.assignments || []).find(a => a._id === assignmentId);

  useEffect(() => {
    if (!assignment && courseId) {
      useCourseStore.getState().fetchCourseById(courseId);
    }
  }, [assignment, courseId]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});
  const [attempts, setAttempts] = useState<any[]>([]);
  const [bestAttempt, setBestAttempt] = useState<any>(null);
  const [latestResult, setLatestResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const storageKey = `assignment_answers_${assignmentId}`;

  // Restore persisted answers on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) setAnswers(JSON.parse(raw));
      } catch { /* ignore */ }
    })();
  }, [storageKey]);

  // Persist answers whenever they change
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      AsyncStorage.setItem(storageKey, JSON.stringify(answers)).catch(() => {});
    }
  }, [answers, storageKey]);

  useEffect(() => {
    let cancelled = false;
    const loadAttempts = async () => {
      if (!courseId || !assignmentId) return;
      try {
        const response = await apiClient.get(
          `/courses/${courseId}/assignments/${assignmentId}/attempts`
        );
        if (cancelled) return;
        setAttempts(response.data?.attempts || []);
        setBestAttempt(response.data?.best || null);
      } catch {
        // No attempts yet or offline; keep the quiz usable.
      }
    };
    loadAttempts();
    return () => {
      cancelled = true;
    };
  }, [courseId, assignmentId]);

  if (!assignment) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Assignment not found</Text>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); }} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSelectOption = (questionId: string, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const handleInputChange = (questionId: string, text: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: text }));
  };

  const handleSubmitQuiz = async () => {
    if (!courseId || !assignmentId || !assignment) return;

    const unanswered = (assignment.questions || []).filter(
      (question) => !String(answers[question._id] || '').trim()
    );
    if (unanswered.length > 0) {
      Alert.alert(
        'Answer All Questions',
        `Please answer ${unanswered.length} remaining question${unanswered.length === 1 ? '' : 's'} before submitting.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post(
        `/courses/${courseId}/assignments/${assignmentId}/submit`,
        { answers }
      );
      if (response.data?.success) {
        const { submission, attempts: nextAttempts, best } = response.data;
        setLatestResult(submission);
        setAttempts(nextAttempts || []);
        setBestAttempt(best || submission);
        setShowExplanation(
          (assignment.questions || []).reduce((acc, question) => {
            acc[question._id] = true;
            return acc;
          }, {} as Record<string, boolean>)
        );
        AsyncStorage.removeItem(storageKey).catch(() => {});
        Alert.alert(
          submission?.passed ? 'Quiz Passed' : 'Quiz Submitted',
          `Score: ${submission?.score ?? 0}/${submission?.maxScore ?? 0} (${submission?.percentage ?? 0}%)`
        );
      }
    } catch (error: any) {
      Alert.alert('Unable to submit quiz', error.response?.data?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle={colors.statusBarStyle === 'dark' ? 'dark-content' : 'light-content'} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); }} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{assignment.title}</Text>
          <Text style={styles.headerSubtitle}>
            {assignment.questions?.length || 0} Questions
            {bestAttempt ? ` · Best ${bestAttempt.percentage || 0}%` : ''}
            {attempts.length > 0 ? ` · ${attempts.length} attempt${attempts.length === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {assignment.description ? (
          <Text style={styles.description}>{assignment.description}</Text>
        ) : null}

        {latestResult && (
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: latestResult.passed ? colors.success + '12' : colors.danger + '10',
                borderColor: latestResult.passed ? colors.success + '40' : colors.danger + '30',
              },
            ]}
          >
            <View style={styles.resultRow}>
              <Text style={styles.resultTitle}>
                {latestResult.passed ? 'Passed' : 'Submitted'}
              </Text>
              <Text style={[styles.resultScore, { color: latestResult.passed ? colors.success : colors.danger }]}>
                {latestResult.percentage || 0}%
              </Text>
            </View>
            <Text style={styles.resultMeta}>
              Score: {latestResult.score ?? 0}/{latestResult.maxScore ?? 0} · Attempt {latestResult.attemptNumber}
            </Text>
            {bestAttempt && (
              <Text style={styles.resultMeta}>
                Best score: {bestAttempt.percentage || 0}% across {attempts.length} attempt{attempts.length === 1 ? '' : 's'}
              </Text>
            )}
          </View>
        )}

        {assignment.questions?.map((q, index) => {

          const showExp = showExplanation[q?._id];

          if (!q) return null;

          return (
            <View key={q._id || index} style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <View style={[styles.qNum, { backgroundColor: courseColor }]}>
                  <Text style={styles.qNumText}>{index + 1}</Text>
                </View>
                <Text style={styles.questionText}>{q.questionText}</Text>
              </View>

              {q.type === 'mcq' ? (
                <View style={styles.optionsContainer}>
                  {q.options?.map((option, oIdx) => {
                    const isCurrentOption = answers[q._id] === option;
                    const isActuallyCorrect = option === q.correctAnswer;
                    
                    let optionStyle: any[] = [styles.option];
                    let textStyle: any[] = [styles.optionText];
                    
                    if (showExp) {
                      if (isActuallyCorrect) {
                        optionStyle.push(styles.optionCorrect);
                        textStyle.push(styles.textCorrect);
                      } else if (isCurrentOption) {
                        optionStyle.push(styles.optionWrong);
                        textStyle.push(styles.textWrong);
                      }
                    } else if (isCurrentOption) {
                      optionStyle.push({ borderColor: courseColor, backgroundColor: courseColor + '10' });
                    }

                    return (
                      <TouchableOpacity
                        key={oIdx}
                        disabled={showExp}
                        onPress={() => handleSelectOption(q._id, option)}
                        style={optionStyle}
                      >
                        <Text style={textStyle}>{option}</Text>
                        {showExp && isActuallyCorrect && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        )}
                        {showExp && isCurrentOption && !isActuallyCorrect && (
                          <Ionicons name="close-circle" size={20} color={colors.danger} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Type your answer here..."
                    value={answers[q._id] || ''}
                    onChangeText={(text) => handleInputChange(q._id, text)}
                    placeholderTextColor={colors.textSecondary}
                    editable={!showExp}
                  />
                </View>
              )}

              {showExp && (
                <View style={styles.explanationBox}>
                  <View style={styles.expHeader}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.expTitle}>Explanation</Text>
                  </View>
                  {q.type !== 'mcq' && (
                    <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 4, color: (answers[q._id] || '').trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase() ? colors.success : colors.danger }}>
                      {(answers[q._id] || '').trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase()
                        ? '✅ Correct answer!'
                        : `❌ Your answer: "${answers[q._id]}"`}
                    </Text>
                  )}
                  <Text style={styles.expText}>
                    {q.explanation || `The correct answer is: ${q.correctAnswer}`}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        <TouchableOpacity
          onPress={handleSubmitQuiz}
          disabled={submitting}
          style={[styles.finishBtn, { backgroundColor: courseColor }, submitting && { opacity: 0.6 }]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.finishBtnText}>Submit Quiz</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { if (router.canGoBack()) router.back(); }}
          style={{ alignItems: 'center', paddingVertical: 16 }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Close</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}


