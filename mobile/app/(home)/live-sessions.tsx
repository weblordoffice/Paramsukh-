import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import apiClient from '../../utils/apiClient';
import { API_URL } from '../../config/api';
import { useTheme } from '../../hooks/useTheme';

type LiveSession = {
  _id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  durationInMinutes: number;
  meetingPlatform?: string;
  meetingLink: string;
  meetingPassword?: string | null;
  capacity?: number | null;
  registrationCount?: number;
  isRegistered?: boolean;
  isFull?: boolean;
  audienceType?: 'all' | 'plans';
  planSlugs?: string[];
  recordingUrl?: string | null;
  status?: 'scheduled' | 'completed' | 'cancelled';
};

type TabKey = 'upcoming' | 'past';

export default function LiveSessionsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('upcoming');
  const [upcoming, setUpcoming] = useState<LiveSession[]>([]);
  const [past, setPast] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingRegistrationId, setPendingRegistrationId] = useState<string | null>(null);

  const loadSessions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await apiClient.get('/live-sessions');
      setUpcoming(response.data?.upcoming || []);
      setPast(response.data?.past || []);
    } catch (error: any) {
      Alert.alert('Unable to load sessions', error.response?.data?.message || 'Please try again.');
      setUpcoming([]);
      setPast([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const sessions = tab === 'upcoming' ? upcoming : past;

  const openLink = async (url?: string | null) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Cannot open link', 'This meeting link is not supported on your device.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Cannot open link', 'Please try again.');
    }
  };

  const registerForSession = async (session: LiveSession) => {
    setPendingRegistrationId(session._id);
    try {
      const response = await apiClient.post(`/live-sessions/${session._id}/register`);
      if (response.data?.success) {
        Alert.alert('Registered', 'You are registered for this live session. A reminder will be sent before it starts.');
        await loadSessions();
      }
    } catch (error: any) {
      Alert.alert('Registration failed', error.response?.data?.message || 'Please try again.');
    } finally {
      setPendingRegistrationId(null);
    }
  };

  const cancelRegistration = (session: LiveSession) => {
    Alert.alert('Cancel Registration', `Cancel your registration for "${session.title}"?`, [
      { text: 'Keep Registration', style: 'cancel' },
      {
        text: 'Cancel Registration',
        style: 'destructive',
        onPress: async () => {
          setPendingRegistrationId(session._id);
          try {
            await apiClient.delete(`/live-sessions/${session._id}/register`);
            await loadSessions();
          } catch (error: any) {
            Alert.alert('Cancel failed', error.response?.data?.message || 'Please try again.');
          } finally {
            setPendingRegistrationId(null);
          }
        },
      },
    ]);
  };

  const addToCalendar = (session: LiveSession) => {
    openLink(`${API_URL}/live-sessions/${session._id}/calendar.ics`);
  };

  const getSessionState = (session: LiveSession) => {
    const start = new Date(session.scheduledAt).getTime();
    const end = start + Number(session.durationInMinutes || 60) * 60000;
    const now = Date.now();
    return {
      isLive: now >= start && now <= end,
      hasEnded: now > end || session.status === 'completed',
    };
  };

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
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 4,
      marginBottom: 18,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
    tabActive: {
      backgroundColor: colors.surface,
      shadowColor: colors.border,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: colors.primary, fontWeight: '700' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(239,68,68,0.12)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    upcomingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(241,132,45,0.12)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    pastBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    liveText: { fontSize: 10, fontWeight: '800', color: '#EF4444' },
    upcomingText: { fontSize: 10, fontWeight: '800', color: '#F1842D' },
    pastText: { fontSize: 10, fontWeight: '800', color: colors.textSecondary },
    title: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
    description: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 4 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11, color: colors.textSecondary },
    registeredBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(16,185,129,0.12)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    registeredText: { fontSize: 10, fontWeight: '800', color: '#059669' },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    calendarBtn: {
      width: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 10,
    },
    primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    secondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    disabledBtn: { opacity: 0.5 },
    loading: { paddingVertical: 80, alignItems: 'center' },
    empty: { paddingVertical: 60, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
  }), [colors]);

  const formatDateTime = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderSession = (session: LiveSession) => {
    const { isLive, hasEnded } = getSessionState(session);
    const badgeStyle = isLive ? s.liveBadge : hasEnded ? s.pastBadge : s.upcomingBadge;
    const badgeTextStyle = isLive ? s.liveText : hasEnded ? s.pastText : s.upcomingText;
    const badgeLabel = isLive ? 'LIVE NOW' : hasEnded ? 'ENDED' : 'UPCOMING';

    return (
      <View key={session._id} style={s.card}>
        <View style={s.cardTop}>
          <View style={badgeStyle}>
            <Ionicons
              name={isLive ? 'radio' : hasEnded ? 'checkmark-done' : 'calendar-outline'}
              size={11}
              color={isLive ? '#EF4444' : hasEnded ? colors.textSecondary : '#F1842D'}
            />
            <Text style={badgeTextStyle}>{badgeLabel}</Text>
          </View>
          {session.isRegistered && (
            <View style={s.registeredBadge}>
              <Ionicons name="checkmark-circle" size={11} color="#059669" />
              <Text style={s.registeredText}>Registered</Text>
            </View>
          )}
        </View>

        <Text style={s.title}>{session.title}</Text>
        {!!session.description && <Text style={s.description}>{session.description}</Text>}

        <View style={s.metaRow}>
          <View style={s.meta}>
            <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
            <Text style={s.metaText}>{formatDateTime(session.scheduledAt)}</Text>
          </View>
          <View style={s.meta}>
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={s.metaText}>{session.durationInMinutes} mins</Text>
          </View>
          <View style={s.meta}>
            <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
            <Text style={s.metaText}>
              {session.registrationCount || 0}{session.capacity ? ` / ${session.capacity}` : ''} registered
            </Text>
          </View>
        </View>

        <View style={s.actionRow}>
          {!hasEnded ? (
            session.isRegistered ? (
              <>
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={() => openLink(session.meetingLink)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="videocam" size={16} color="#FFFFFF" />
                  <Text style={s.primaryBtnText}>{isLive ? 'Join Live' : 'Join Meeting'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.calendarBtn} onPress={() => addToCalendar(session)}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.secondaryBtn, { flex: 0.8 }]}
                  onPress={() => cancelRegistration(session)}
                  disabled={pendingRegistrationId === session._id}
                >
                  <Text style={s.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[s.primaryBtn, (session.isFull || pendingRegistrationId === session._id) && s.disabledBtn]}
                  onPress={() => registerForSession(session)}
                  disabled={session.isFull || pendingRegistrationId === session._id}
                  activeOpacity={0.85}
                >
                  {pendingRegistrationId === session._id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
                      <Text style={s.primaryBtnText}>{session.isFull ? 'Session Full' : 'Register'}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={s.calendarBtn} onPress={() => addToCalendar(session)}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </>
            )
          ) : session.recordingUrl ? (
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => openLink(session.recordingUrl)}
              activeOpacity={0.85}
            >
              <Ionicons name="play-circle" size={16} color="#FFFFFF" />
              <Text style={s.primaryBtnText}>Watch Recording</Text>
            </TouchableOpacity>
          ) : (
            <View style={[s.secondaryBtn, s.disabledBtn]}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={s.secondaryBtnText}>Recording not available</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => { if (router.canGoBack()) router.back(); }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Live Sessions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadSessions(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, tab === 'upcoming' && s.tabActive]}
            onPress={() => setTab('upcoming')}
          >
            <Text style={[s.tabText, tab === 'upcoming' && s.tabTextActive]}>
              Upcoming ({upcoming.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, tab === 'past' && s.tabActive]}
            onPress={() => setTab('past')}
          >
            <Text style={[s.tabText, tab === 'past' && s.tabTextActive]}>
              Past ({past.length})
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="videocam-outline" size={48} color={colors.textSecondary} />
            <Text style={s.emptyTitle}>
              {tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}
            </Text>
            <Text style={s.emptyText}>
              {tab === 'upcoming'
                ? 'New live coaching sessions will appear here.'
                : 'Completed sessions and recordings will appear here.'}
            </Text>
          </View>
        ) : (
          sessions.map(renderSession)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
