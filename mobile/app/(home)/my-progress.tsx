import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import apiClient from '../../utils/apiClient';
import { useTheme } from '../../hooks/useTheme';
import CertificateViewerModal from '../../components/CertificateViewerModal';

type RangeDays = 7 | 30 | 90;

type TrendPoint = {
  date: string;
  learning: number;
  community: number;
  events: number;
  achievements: number;
  total: number;
};

type CourseProgressItem = {
  courseId: string;
  title: string;
  category?: string | null;
  progress: number;
  isCompleted: boolean;
  lastAccessedAt?: string | null;
  completedAt?: string | null;
};

type Analytics = {
  rangeDays: number;
  profile: {
    displayName?: string | null;
    memberSince?: string | null;
    loginCount: number;
    completeness: { percent: number; missing: string[] };
  };
  overview: { currentStreak: number; activeDays: number; rangeDays: number };
  learning: {
    totalEnrollments: number;
    completedCourses: number;
    inProgressCourses: number;
    averageProgress: number;
    certificates: number;
  };
  events: { registrations: number; attended: number };
  goals: {
    total: number;
    active: number;
    completed: number;
    paused: number;
    averageProgress: number;
    activeGoals: Array<{
      _id: string;
      title: string;
      category: string;
      currentValue: number;
      targetValue: number;
      unit?: string;
      targetDate?: string | null;
      progressPercent: number;
    }>;
  };
  community: { points: number; posts: number; comments: number };
  wellness: null | {
    stressLevel: number;
    sleepQuality: number;
    energyLevel: number;
    moodRating: number;
    physicalActivityLevel?: string;
    wellnessScore: number;
    updatedAt?: string | null;
  };
  courses: CourseProgressItem[];
  trend: TrendPoint[];
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  requirement: string;
  icon: string;
  color: string;
  category: string;
  unlocked: boolean;
  unlockedAt?: string | null;
  progress: { current: number; target: number; percent: number; unit: string };
};

type CertificateItem = {
  _id: string;
  certificateId: string;
  courseName: string;
  issuedTo: string;
  issuedAt: string;
  viewUrl?: string;
  verificationUrl?: string;
};

export default function MyProgressScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [range, setRange] = useState<RangeDays>(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achievementStats, setAchievementStats] = useState<{ unlocked: number; total: number } | null>(null);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [selectedCert, setSelectedCert] = useState<CertificateItem | null>(null);
  const [certModalVisible, setCertModalVisible] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [analyticsRes, achievementsRes, certsRes] = await Promise.all([
        apiClient.get('/user/analytics', { params: { range } }),
        apiClient.get('/user/achievements'),
        apiClient.get('/user/profile/certificates'),
      ]);

      if (analyticsRes.data?.success) setAnalytics(analyticsRes.data);
      if (achievementsRes.data?.success) {
        setAchievements(achievementsRes.data.achievements || []);
        setAchievementStats(achievementsRes.data.stats || null);
      }
      if (certsRes.data?.success) setCertificates(certsRes.data.certificates || []);
    } catch (error: any) {
      Alert.alert('Unable to load progress', error.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const completionRate = analytics?.learning.averageProgress ?? 0;
  const trendMax = Math.max(1, ...(analytics?.trend || []).map((point) => point.total));
  const firstTrendDate = analytics?.trend?.[0]?.date || '';
  const lastTrendDate = analytics?.trend && analytics.trend.length > 0
    ? analytics.trend[analytics.trend.length - 1].date
    : '';
  const unlockedAchievements = achievements.filter((badge) => badge.unlocked);
  const lockedAchievements = achievements.filter((badge) => !badge.unlocked);

  const s = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    content: { padding: 20, paddingBottom: 40 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    sectionAction: { fontSize: 12, fontWeight: '700', color: colors.primary },
    overviewRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    overviewText: { flex: 1 },
    eyebrow: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    overviewTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },
    overviewSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 },
    ring: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 8,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '10',
    },
    ringValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
    ringLabel: { fontSize: 9, fontWeight: '700', color: colors.textSecondary },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    statCard: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    rangeTabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      padding: 3,
      marginBottom: 12,
    },
    rangeTab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
    rangeTabActive: { backgroundColor: colors.surface },
    rangeText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    rangeTextActive: { color: colors.primary },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 120,
      gap: 2,
      marginTop: 8,
      paddingTop: 8,
    },
    barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    bar: { width: '100%', minHeight: 3, borderRadius: 3, backgroundColor: colors.primary },
    chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    chartLabel: { fontSize: 9, color: colors.textSecondary },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    legendChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.surfaceSecondary,
    },
    legendText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
    courseRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 12,
    },
    courseTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    courseTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
    courseMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },
    progressTrack: {
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.surfaceSecondary,
      marginTop: 8,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
    coursePercent: { fontSize: 12, fontWeight: '800', color: colors.primary },
    wellnessRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    wellnessLabel: { width: 70, fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    wellnessTrack: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceSecondary,
      overflow: 'hidden',
      marginHorizontal: 8,
    },
    wellnessFill: { height: '100%', borderRadius: 4 },
    wellnessValue: { width: 34, fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'right' },
    goalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 10,
    },
    goalTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    goalTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
    goalMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    certificateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 12,
      gap: 10,
    },
    certificateInfo: { flex: 1 },
    certificateTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    certificateMeta: { fontSize: 10, color: colors.textSecondary, marginTop: 3 },
    certificateActions: { flexDirection: 'row', gap: 8 },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    badgeCard: {
      width: '48%',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      backgroundColor: colors.surface,
    },
    badgeCardLocked: { opacity: 0.55 },
    badgeIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    badgeTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
    badgeDesc: { fontSize: 10, color: colors.textSecondary, marginTop: 3, lineHeight: 14 },
    badgeDate: { fontSize: 9, color: colors.textSecondary, marginTop: 6 },
    badgeProgressTrack: {
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.surfaceSecondary,
      marginTop: 8,
      overflow: 'hidden',
    },
    badgeProgressFill: { height: '100%', borderRadius: 3 },
    completenessBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.primary + '10',
      borderWidth: 1,
      borderColor: colors.primary + '30',
      marginBottom: 16,
    },
    completenessText: { flex: 1 },
    completenessTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
    completenessSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    completenessBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 9,
      backgroundColor: colors.primary,
    },
    completenessBtnText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
    empty: { paddingVertical: 30, alignItems: 'center' },
    emptyText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
    loading: { paddingVertical: 80, alignItems: 'center' },
  }), [colors]);

  const formatDate = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
    if (!value) return 'Recently';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString('en-IN', options || { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const openCourse = (courseId: string) => {
    if (!courseId) return;
    router.push({ pathname: '/course-detail', params: { id: courseId } });
  };

  const openCertificate = (cert: CertificateItem) => {
    setSelectedCert(cert);
    setCertModalVisible(true);
  };

  const openUrl = async (url?: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link', 'Please try again.');
    }
  };

  const wellnessBars = analytics?.wellness ? [
    { label: 'Stress', value: analytics.wellness.stressLevel, color: '#EF4444' },
    { label: 'Sleep', value: analytics.wellness.sleepQuality, color: '#6366F1' },
    { label: 'Energy', value: analytics.wellness.energyLevel, color: '#10B981' },
    { label: 'Mood', value: analytics.wellness.moodRating, color: '#F59E0B' },
  ] : [];

  if (loading && !analytics) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>My Progress</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Progress</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={s.card}>
          <View style={s.overviewRow}>
            <View style={s.overviewText}>
              <Text style={s.eyebrow}>Gurukul Disciple Since</Text>
              <Text style={s.overviewTitle}>{formatDate(analytics?.profile.memberSince, { month: 'long', year: 'numeric' })}</Text>
              <Text style={s.overviewSub}>
                {analytics?.overview.currentStreak || 0}-day activity streak · {analytics?.profile.loginCount || 0} logins
              </Text>
            </View>
            <View style={s.ring}>
              <Text style={s.ringValue}>{completionRate}%</Text>
              <Text style={s.ringLabel}>PROGRESS</Text>
            </View>
          </View>
        </View>

        {analytics?.profile.completeness && analytics.profile.completeness.percent < 100 && (
          <View style={s.completenessBanner}>
            <View style={s.completenessText}>
              <Text style={s.completenessTitle}>
                Profile {analytics.profile.completeness.percent}% complete
              </Text>
              <Text style={s.completenessSub}>
                Add the missing details to improve your personalized guidance.
              </Text>
            </View>
            <TouchableOpacity style={s.completenessBtn} onPress={() => router.push('/(home)/edit-profile')}>
              <Text style={s.completenessBtnText}>Complete</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.statsGrid}>
          {[
            { label: 'Courses Enrolled', value: analytics?.learning.totalEnrollments || 0, icon: 'book-outline', color: '#8B5CF6' },
            { label: 'Courses Completed', value: analytics?.learning.completedCourses || 0, icon: 'checkmark-circle-outline', color: '#3B82F6' },
            { label: 'Certificates', value: analytics?.learning.certificates || 0, icon: 'ribbon-outline', color: '#D97706' },
            { label: 'Badges', value: achievementStats?.unlocked || 0, icon: 'medal-outline', color: '#F59E0B' },
            { label: 'Events Registered', value: analytics?.events.registrations || 0, icon: 'calendar-outline', color: '#10B981' },
            { label: 'Goals Active', value: analytics?.goals.active || 0, icon: 'flag-outline', color: '#EC4899' },
          ].map((stat) => (
            <View key={stat.label} style={s.statCard}>
              <Ionicons name={stat.icon as any} size={20} color={stat.color} />
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Activity</Text>
            <View style={s.rangeTabs}>
              {([7, 30, 90] as RangeDays[]).map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[s.rangeTab, range === value && s.rangeTabActive]}
                  onPress={() => setRange(value)}
                >
                  <Text style={[s.rangeText, range === value && s.rangeTextActive]}>{value}d</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.chart}>
            {(analytics?.trend || []).map((point) => {
              const height = Math.max(3, (point.total / trendMax) * 100);
              return (
                <View key={point.date} style={s.barWrap}>
                  <View style={[s.bar, { height }]} />
                </View>
              );
            })}
          </View>
          <View style={s.chartLabels}>
            <Text style={s.chartLabel}>{firstTrendDate.slice(5)}</Text>
            <Text style={s.chartLabel}>{lastTrendDate.slice(5)}</Text>
          </View>

          <View style={s.legendRow}>
            <View style={s.legendChip}><Text style={s.legendText}>Learning {(analytics?.trend || []).reduce((sum, point) => sum + point.learning, 0)}</Text></View>
            <View style={s.legendChip}><Text style={s.legendText}>Community {(analytics?.trend || []).reduce((sum, point) => sum + point.community, 0)}</Text></View>
            <View style={s.legendChip}><Text style={s.legendText}>Events {(analytics?.trend || []).reduce((sum, point) => sum + point.events, 0)}</Text></View>
            <View style={s.legendChip}><Text style={s.legendText}>Milestones {(analytics?.trend || []).reduce((sum, point) => sum + point.achievements, 0)}</Text></View>
          </View>
        </View>

        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Learning Progress</Text>
            <Text style={s.sectionAction}>{analytics?.learning.inProgressCourses || 0} in progress</Text>
          </View>
          {(analytics?.courses || []).length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="book-outline" size={30} color={colors.textSecondary} />
              <Text style={s.emptyText}>Enroll in a course to start tracking your learning.</Text>
            </View>
          ) : (
            (analytics?.courses || []).map((course) => (
              <TouchableOpacity
                key={course.courseId}
                style={s.courseRow}
                onPress={() => openCourse(course.courseId)}
                activeOpacity={0.8}
              >
                <View style={s.courseTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.courseTitle} numberOfLines={1}>{course.title}</Text>
                    <Text style={s.courseMeta}>
                      {course.isCompleted ? 'Completed' : 'In progress'}
                      {course.lastAccessedAt ? ` · Last activity ${formatDate(course.lastAccessedAt)}` : ''}
                    </Text>
                  </View>
                  <Text style={s.coursePercent}>{course.progress}%</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${Math.min(100, course.progress)}%` }]} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Wellness Snapshot</Text>
            {analytics?.wellness && (
              <Text style={s.sectionAction}>{analytics.wellness.wellnessScore}/100</Text>
            )}
          </View>
          {!analytics?.wellness ? (
            <View style={s.empty}>
              <Ionicons name="heart-outline" size={30} color={colors.textSecondary} />
              <Text style={s.emptyText}>Complete your wellness assessment to see your snapshot.</Text>
            </View>
          ) : (
            <>
              {wellnessBars.map((bar) => (
                <View key={bar.label} style={s.wellnessRow}>
                  <Text style={s.wellnessLabel}>{bar.label}</Text>
                  <View style={s.wellnessTrack}>
                    <View style={[s.wellnessFill, { width: `${Math.min(100, bar.value * 10)}%`, backgroundColor: bar.color }]} />
                  </View>
                  <Text style={s.wellnessValue}>{bar.value}/10</Text>
                </View>
              ))}
              <Text style={s.courseMeta}>
                Overall wellness score reflects your latest assessment. Revisit your assessment periodically to track changes.
              </Text>
            </>
          )}
        </View>

        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Wellness Goals</Text>
            <TouchableOpacity onPress={() => router.push('/(home)/wellness-goals' as any)}>
              <Text style={s.sectionAction}>Manage</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.courseMeta}>
            {analytics?.goals.active || 0} active · {analytics?.goals.completed || 0} completed
          </Text>
          {(analytics?.goals.activeGoals || []).length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="flag-outline" size={30} color={colors.textSecondary} />
              <Text style={s.emptyText}>Set a wellness goal to make your journey measurable.</Text>
            </View>
          ) : (
            (analytics?.goals.activeGoals || []).slice(0, 3).map((goal) => (
              <View key={goal._id} style={s.goalRow}>
                <View style={s.goalTop}>
                  <Text style={s.goalTitle} numberOfLines={1}>{goal.title}</Text>
                  <Text style={s.coursePercent}>{goal.progressPercent}%</Text>
                </View>
                <Text style={s.goalMeta}>
                  {goal.currentValue}/{goal.targetValue} {goal.unit || ''}
                  {goal.targetDate ? ` · Due ${formatDate(goal.targetDate)}` : ''}
                </Text>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${goal.progressPercent}%` }]} />
                </View>
              </View>
            ))
          )}
        </View>

        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Verifiable Certificates</Text>
            <Text style={s.sectionAction}>{certificates.length}</Text>
          </View>
          {certificates.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="ribbon-outline" size={30} color={colors.textSecondary} />
              <Text style={s.emptyText}>Complete courses to 100% to earn certificates.</Text>
            </View>
          ) : (
            certificates.map((cert) => (
              <View key={cert._id} style={s.certificateRow}>
                <View style={s.certificateInfo}>
                  <Text style={s.certificateTitle} numberOfLines={1}>{cert.courseName}</Text>
                  <Text style={s.certificateMeta}>
                    {cert.certificateId} · {formatDate(cert.issuedAt)}
                  </Text>
                </View>
                <View style={s.certificateActions}>
                  <TouchableOpacity style={s.iconBtn} onPress={() => openCertificate(cert)}>
                    <Ionicons name="eye-outline" size={17} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => openUrl(cert.viewUrl)}>
                    <Ionicons name="download-outline" size={17} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Achievements</Text>
            <Text style={s.sectionAction}>
              {unlockedAchievements.length}/{achievements.length}
            </Text>
          </View>
          {unlockedAchievements.length > 0 && (
            <>
              <Text style={s.eyebrow}>Unlocked</Text>
              <View style={[s.badgeGrid, { marginTop: 10, marginBottom: 16 }]}>
                {unlockedAchievements.map((badge) => (
                  <View key={badge.id} style={s.badgeCard}>
                    <View style={[s.badgeIconWrap, { backgroundColor: badge.color + '18' }]}>
                      <Ionicons name={badge.icon as any} size={20} color={badge.color} />
                    </View>
                    <Text style={s.badgeTitle}>{badge.title}</Text>
                    <Text style={s.badgeDesc}>{badge.description}</Text>
                    <Text style={s.badgeDate}>Unlocked {formatDate(badge.unlockedAt)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {lockedAchievements.length > 0 && (
            <>
              <Text style={s.eyebrow}>In Progress</Text>
              <View style={[s.badgeGrid, { marginTop: 10 }]}>
                {lockedAchievements.map((badge) => (
                  <View key={badge.id} style={[s.badgeCard, s.badgeCardLocked]}>
                    <View style={[s.badgeIconWrap, { backgroundColor: badge.color + '18' }]}>
                      <Ionicons name={badge.icon as any} size={20} color={badge.color} />
                    </View>
                    <Text style={s.badgeTitle}>{badge.title}</Text>
                    <Text style={s.badgeDesc}>{badge.requirement}</Text>
                    <View style={s.badgeProgressTrack}>
                      <View
                        style={[
                          s.badgeProgressFill,
                          { width: `${badge.progress.percent}%`, backgroundColor: badge.color },
                        ]}
                      />
                    </View>
                    <Text style={s.badgeDate}>
                      {badge.progress.current}/{badge.progress.target} {badge.progress.unit}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <CertificateViewerModal
        visible={certModalVisible}
        onClose={() => setCertModalVisible(false)}
        certificate={selectedCert}
      />
    </SafeAreaView>
  );
}
