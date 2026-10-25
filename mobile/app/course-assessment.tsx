import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import apiClient from '../utils/apiClient';
import { useTheme } from '../hooks/useTheme';

type AssessmentQuestion = {
  _id: string;
  prompt: string;
  type: 'mcq' | 'short_answer' | 'descriptive';
  options?: { key: string; text: string }[];
  points: number;
};

type Assessment = {
  _id: string;
  title: string;
  instructions?: string;
  questions: AssessmentQuestion[];
  passingRule: { type: 'correct_count' | 'percentage'; value: number };
  maxAttempts: number;
  retakeCooldownHours: number;
  timeLimitMinutes: number;
  vivaRequired?: boolean;
};

type AssessmentSummary = {
  _id: string;
  title: string;
  instructions?: string;
  questionCount: number;
  passingRule: { type: 'correct_count' | 'percentage'; value: number };
  maxAttempts: number;
  retakeCooldownHours: number;
  timeLimitMinutes: number;
  vivaRequired?: boolean;
  isEnabled: boolean;
};

type AttemptSummary = {
  _id: string;
  attemptNumber: number;
  status: string;
  submittedAt?: string;
  expiresAt?: string;
  startedAt?: string;
  correctCount: number;
  totalQuestions: number;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean | null;
};

type Overview = {
  assessment: AssessmentSummary | null;
  eligibility: {
    enrolled: boolean;
    learningComplete: boolean;
    requiredAssignmentsComplete: boolean;
    assessmentUnlocked: boolean;
  };
  attempts: {
    used: number;
    remaining: number;
    canStart: boolean;
    activeAttempt: AttemptSummary | null;
    latestAttempt: AttemptSummary | null;
    nextAvailableAt: string | null;
  };
  canStart: boolean;
  blockedReason: string | null;
};

type VivaApplication = {
  _id: string;
  status: string;
  scheduledAt?: string;
  meetingPlatform?: string;
  meetingLink?: string;
  notes?: string;
  result?: { status?: string; remarks?: string; feedback?: string };
};

type VivaState = {
  canApply: boolean;
  reason: string | null;
  application: VivaApplication | null;
};

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

const formatResultStatus = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export default function CourseAssessmentScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const courseId = String(params.courseId || '');
  const courseTitle = String(params.courseTitle || 'Course');
  const courseColor = String(params.courseColor || colors.primary);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<AttemptSummary | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [lastResult, setLastResult] = useState<AttemptSummary | null>(null);
  const [history, setHistory] = useState<AttemptSummary[]>([]);
  const [viva, setViva] = useState<VivaState | null>(null);
  const [vivaNote, setVivaNote] = useState('');
  const [vivaSubmitting, setVivaSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
    scroll: { padding: 16, paddingBottom: 48 },
    hero: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      marginBottom: 16,
    },
    heroTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
    heroSub: { marginTop: 4, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceSecondary,
    },
    chipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 16,
    },
    cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 8 },
    bodyText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceSecondary,
      overflow: 'hidden',
      marginTop: 10,
    },
    progressFill: { height: '100%', borderRadius: 4 },
    requirementRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    requirementText: { flex: 1, fontSize: 13, color: colors.textSecondary },
    primaryBtn: {
      marginTop: 14,
      backgroundColor: courseColor,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
    disabledBtn: { opacity: 0.55 },
    secondaryBtn: {
      marginTop: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      alignItems: 'center',
    },
    secondaryBtnText: { color: colors.text, fontWeight: '700', fontSize: 14 },
    warningBox: {
      marginTop: 12,
      backgroundColor: 'rgba(245,158,11,0.12)',
      borderRadius: 10,
      padding: 12,
    },
    warningText: { color: '#B45309', fontSize: 12, lineHeight: 18 },
    questionCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    questionHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 12,
    },
    questionNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    questionNumberText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
    questionPrompt: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    optionRowSelected: { borderColor: courseColor, backgroundColor: `${courseColor}12` },
    optionKey: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionKeySelected: { backgroundColor: courseColor, borderColor: courseColor },
    optionKeyText: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
    optionText: { flex: 1, fontSize: 13, color: colors.text },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14,
      backgroundColor: colors.background,
    },
    resultBig: { fontSize: 34, fontWeight: '900', color: colors.text },
    resultLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    resultRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
    resultStat: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    resultStatValue: { fontSize: 17, fontWeight: '800', color: colors.text },
    resultStatLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    historyTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    historyMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    timerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(239,68,68,0.12)',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginBottom: 12,
    },
    timerText: { fontSize: 12, fontWeight: '800', color: '#DC2626' },
  }), [colors, courseColor]);

  const resetAttemptState = () => {
    setActiveAssessment(null);
    setActiveAttempt(null);
    setAnswers({});
  };

  const loadOverview = useCallback(async () => {
    if (!courseId) {
      setLoading(false);
      return;
    }
    try {
      const response = await apiClient.get(`/courses/${courseId}/assessment`);
      if (response.data?.success) {
        setOverview(response.data);
        const latest = response.data.attempts?.latestAttempt;
        if (latest && latest.status !== 'in_progress') {
          setLastResult(latest);
        }
        if (response.data.attempts?.activeAttempt) {
          const attempt = response.data.attempts.activeAttempt;
          setActiveAttempt(attempt);
          if (response.data.assessment) {
            try {
              const startResponse = await apiClient.post(`/courses/${courseId}/assessment/start`);
              setActiveAssessment(startResponse.data?.assessment || null);
              const existingAnswers = startResponse.data?.attempt?.answers || [];
              const restored: Record<string, string> = {};
              existingAnswers.forEach((entry: any) => {
                if (entry?.questionId && entry.answer !== null && entry.answer !== undefined) {
                  restored[String(entry.questionId)] = String(entry.answer);
                }
              });
              setAnswers(restored);
            } catch {
              setActiveAssessment(null);
            }
          }
        } else {
          resetAttemptState();
        }
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Unable to load the assessment.';
      if (error.response?.status !== 404) {
        Alert.alert('Assessment unavailable', message);
      }
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const loadHistory = useCallback(async () => {
    if (!courseId) return;
    try {
      const response = await apiClient.get(`/courses/${courseId}/assessment/attempts`);
      setHistory(response.data?.attempts || []);
    } catch {
      setHistory([]);
    }
  }, [courseId]);

  const loadViva = useCallback(async () => {
    if (!courseId) return;
    try {
      const response = await apiClient.get(`/courses/${courseId}/viva`);
      if (response.data?.success) {
        setViva({
          canApply: response.data.canApply,
          reason: response.data.reason,
          application: response.data.application,
        });
      }
    } catch {
      setViva(null);
    }
  }, [courseId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOverview(), loadHistory(), loadViva()]);
  }, [loadOverview, loadHistory, loadViva]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      refreshAll();
    }, [refreshAll])
  );

  useEffect(() => {
    if (!activeAttempt?.expiresAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeAttempt?.expiresAt]);

  const startAssessment = async () => {
    setStarting(true);
    try {
      const response = await apiClient.post(`/courses/${courseId}/assessment/start`);
      setActiveAssessment(response.data?.assessment || null);
      setActiveAttempt(response.data?.attempt || null);
      const restored: Record<string, string> = {};
      (response.data?.attempt?.answers || []).forEach((entry: any) => {
        if (entry?.questionId && entry.answer !== null && entry.answer !== undefined) {
          restored[String(entry.questionId)] = String(entry.answer);
        }
      });
      setAnswers(restored);
      setLastResult(null);
    } catch (error: any) {
      Alert.alert('Unable to start', error.response?.data?.message || 'Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const submitAssessment = async () => {
    if (!activeAttempt || !activeAssessment) return;
    const unanswered = activeAssessment.questions.filter(
      (question) => !String(answers[question._id] || '').trim()
    );
    Alert.alert(
      unanswered.length ? 'Submit anyway?' : 'Submit assessment?',
      unanswered.length
        ? `${unanswered.length} question${unanswered.length === 1 ? ' is' : 's are'} unanswered. You cannot change answers after submitting.`
        : 'You cannot change answers after submitting.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Submit',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const response = await apiClient.post(`/courses/${courseId}/assessment/submit`, {
                attemptId: activeAttempt._id,
                answers,
              });
              const attempt = response.data?.attempt || null;
              setLastResult(attempt);
              resetAttemptState();
              await refreshAll();
            } catch (error: any) {
              Alert.alert('Submission failed', error.response?.data?.message || 'Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const applyForViva = async () => {
    setVivaSubmitting(true);
    try {
      await apiClient.post(`/courses/${courseId}/viva/apply`, { note: vivaNote.trim() });
      setVivaNote('');
      await loadViva();
      Alert.alert('Viva requested', 'Your viva application has been submitted for review.');
    } catch (error: any) {
      Alert.alert('Unable to apply', error.response?.data?.message || 'Please try again.');
    } finally {
      setVivaSubmitting(false);
    }
  };

  const renderVivaCard = () => {
    if (!viva) return null;
    const application = viva.application;
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Viva</Text>
        {application ? (
          <>
            <Text style={styles.bodyText}>
              Status: <Text style={{ fontWeight: '800', color: colors.text }}>{formatResultStatus(application.status)}</Text>
            </Text>
            {application.scheduledAt ? (
              <Text style={styles.bodyText}>Scheduled: {formatDate(application.scheduledAt)}</Text>
            ) : null}
            {application.meetingPlatform || application.meetingLink ? (
              <Text style={styles.bodyText}>
                {application.meetingPlatform || 'Online'}
                {application.meetingLink ? ` · ${application.meetingLink}` : ''}
              </Text>
            ) : null}
            {application.result?.remarks ? (
              <Text style={styles.bodyText}>Remarks: {application.result.remarks}</Text>
            ) : null}
          </>
        ) : viva.canApply ? (
          <>
            <Text style={styles.bodyText}>
              You passed the assessment. Apply for the viva to earn your course assessment certificate.
            </Text>
            <TextInput
              value={vivaNote}
              onChangeText={setVivaNote}
              placeholder="Anything the examiner should know? (optional)"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[styles.input, { marginTop: 12, minHeight: 70, textAlignVertical: 'top' }]}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, vivaSubmitting && styles.disabledBtn]}
              onPress={applyForViva}
              disabled={vivaSubmitting}
            >
              {vivaSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="mic-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Apply for Viva</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.bodyText}>{viva.reason || 'Viva is not available yet.'}</Text>
        )}
      </View>
    );
  };

  const renderAttemptHistory = () => {
    if (!history.length) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Attempt History</Text>
        {history.map((attempt) => (
          <View key={attempt._id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTitle}>Attempt #{attempt.attemptNumber}</Text>
              <Text style={styles.historyMeta}>
                {formatResultStatus(attempt.status)}
                {attempt.submittedAt ? ` · ${formatDate(attempt.submittedAt)}` : ''}
              </Text>
            </View>
            <Text style={{
              fontSize: 13,
              fontWeight: '800',
              color: attempt.passed ? colors.success : colors.textSecondary,
            }}>
              {attempt.status === 'in_progress' ? 'In progress' : `${Math.round(attempt.percentage || 0)}%`}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={courseColor} />
        </View>
      </SafeAreaView>
    );
  }

  const remainingMs = activeAttempt?.expiresAt
    ? new Date(activeAttempt.expiresAt).getTime() - now
    : null;
  const timerMinutes = remainingMs !== null ? Math.max(0, Math.floor(remainingMs / 60000)) : null;
  const timerSeconds = remainingMs !== null ? Math.max(0, Math.floor((remainingMs % 60000) / 1000)) : null;
  const timerExpired = remainingMs !== null && remainingMs <= 0;
  const answeredCount = activeAssessment
    ? activeAssessment.questions.filter((question) => String(answers[question._id] || '').trim()).length
    : 0;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/course-detail'))}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{courseTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!overview?.assessment ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assessment not available</Text>
            <Text style={styles.bodyText}>
              This course does not have a certification assessment yet. Keep learning and check back later.
            </Text>
          </View>
        ) : activeAssessment && activeAttempt ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>{activeAssessment.title}</Text>
              <Text style={styles.heroSub}>
                Answer every question, then submit. You cannot change answers after submitting.
              </Text>
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Ionicons name="help-circle-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.chipText}>
                    {answeredCount}/{activeAssessment.questions.length} answered
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Ionicons name="trophy-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.chipText}>
                    Pass: {activeAssessment.passingRule.type === 'percentage'
                      ? `${activeAssessment.passingRule.value}%`
                      : `${activeAssessment.passingRule.value} correct`}
                  </Text>
                </View>
              </View>
            </View>

            {timerMinutes !== null && (
              <View style={styles.timerPill}>
                <Ionicons name="timer-outline" size={15} color="#DC2626" />
                <Text style={styles.timerText}>
                  {timerExpired ? 'Time expired — submit now' : `${timerMinutes}:${String(timerSeconds ?? 0).padStart(2, '0')} remaining`}
                </Text>
              </View>
            )}

            {activeAssessment.questions.map((question, index) => (
              <View key={question._id} style={styles.questionCard}>
                <View style={styles.questionHead}>
                  <View style={[styles.questionNumber, { backgroundColor: courseColor }]}>
                    <Text style={styles.questionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.questionPrompt}>{question.prompt}</Text>
                </View>

                {question.type === 'mcq' ? (
                  (question.options || []).map((option) => {
                    const selected = String(answers[question._id] || '') === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[styles.optionRow, selected && styles.optionRowSelected]}
                        onPress={() => setAnswers((prev) => ({ ...prev, [question._id]: option.key }))}
                        disabled={timerExpired}
                      >
                        <View style={[styles.optionKey, selected && styles.optionKeySelected]}>
                          <Text style={[styles.optionKeyText, selected && { color: '#FFFFFF' }]}>
                            {option.key.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.optionText}>{option.text}</Text>
                      </TouchableOpacity>
                    );
                  })
                ) : question.type === 'short_answer' ? (
                  <TextInput
                    value={answers[question._id] || ''}
                    onChangeText={(value) => setAnswers((prev) => ({ ...prev, [question._id]: value }))}
                    placeholder="Type your answer"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    autoCapitalize="none"
                    editable={!timerExpired}
                  />
                ) : (
                  <TextInput
                    value={answers[question._id] || ''}
                    onChangeText={(value) => setAnswers((prev) => ({ ...prev, [question._id]: value }))}
                    placeholder="Write your answer"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]}
                    editable={!timerExpired}
                  />
                )}

                <Text style={{ marginTop: 8, fontSize: 11, color: colors.textSecondary }}>
                  {question.points} point{question.points === 1 ? '' : 's'}
                </Text>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.disabledBtn]}
              onPress={submitAssessment}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Submit Assessment</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>{overview.assessment.title}</Text>
              {overview.assessment.instructions ? (
                <Text style={styles.heroSub}>{overview.assessment.instructions}</Text>
              ) : (
                <Text style={styles.heroSub}>
                  Complete this assessment to qualify for a course assessment certificate.
                </Text>
              )}
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Ionicons name="help-circle-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.chipText}>{overview.assessment.questionCount} questions</Text>
                </View>
                <View style={styles.chip}>
                  <Ionicons name="trophy-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.chipText}>
                    Pass: {overview.assessment.passingRule.type === 'percentage'
                      ? `${overview.assessment.passingRule.value}%`
                      : `${overview.assessment.passingRule.value} correct`}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.chipText}>
                    {overview.attempts.remaining} of {overview.assessment.maxAttempts} attempts left
                  </Text>
                </View>
                {overview.assessment.timeLimitMinutes > 0 && (
                  <View style={styles.chip}>
                    <Ionicons name="timer-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.chipText}>{overview.assessment.timeLimitMinutes} min</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Unlock requirements</Text>
              {[
                { label: 'Enrolled in this course', done: overview.eligibility.enrolled },
                { label: 'Course content complete', done: overview.eligibility.learningComplete },
                { label: 'Required assignments complete', done: overview.eligibility.requiredAssignmentsComplete },
              ].map((requirement) => (
                <View key={requirement.label} style={styles.requirementRow}>
                  <Ionicons
                    name={requirement.done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={requirement.done ? colors.success : colors.textSecondary}
                  />
                  <Text style={styles.requirementText}>{requirement.label}</Text>
                </View>
              ))}
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, {
                    width: `${Math.round((
                      Number(overview.eligibility.enrolled)
                      + Number(overview.eligibility.learningComplete)
                      + Number(overview.eligibility.requiredAssignmentsComplete)
                    ) / 3 * 100)}%`,
                    backgroundColor: courseColor,
                  }]}
                />
              </View>

              {overview.blockedReason && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>{overview.blockedReason}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (!overview.attempts.canStart || starting) && styles.disabledBtn,
                ]}
                onPress={startAssessment}
                disabled={!overview.attempts.canStart || starting}
              >
                {starting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="play-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Start Assessment</Text>
                  </>
                )}
              </TouchableOpacity>

              {overview.attempts.nextAvailableAt && (
                <Text style={{ marginTop: 10, fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
                  Next attempt available {formatDate(overview.attempts.nextAvailableAt)}
                </Text>
              )}
            </View>

            {lastResult && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Latest Result</Text>
                <View style={{ alignItems: 'center', marginTop: 6 }}>
                  <Text style={styles.resultBig}>{Math.round(lastResult.percentage || 0)}%</Text>
                  <Text style={styles.resultLabel}>
                    {lastResult.status === 'pending_manual'
                      ? 'Awaiting manual grading'
                      : lastResult.passed
                        ? 'Passed'
                        : 'Not passed'}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatValue}>
                      {lastResult.correctCount}/{lastResult.totalQuestions}
                    </Text>
                    <Text style={styles.resultStatLabel}>Correct</Text>
                  </View>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatValue}>
                      {lastResult.score}/{lastResult.maxScore}
                    </Text>
                    <Text style={styles.resultStatLabel}>Points</Text>
                  </View>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatValue}>#{lastResult.attemptNumber}</Text>
                    <Text style={styles.resultStatLabel}>Attempt</Text>
                  </View>
                </View>
              </View>
            )}

            {renderVivaCard()}
            {renderAttemptHistory()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
