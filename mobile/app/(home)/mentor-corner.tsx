import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useCommunityStore, Mentor } from '@/store/communityStore';

export default function MentorCornerScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const {
    mentors,
    mentorMe,
    mentorLoading,
    fetchMentors,
    fetchMentorMe,
    fetchMyGroups,
  } = useCommunityStore();

  useFocusEffect(
    useCallback(() => {
      fetchMentorMe();
      fetchMyGroups().then(() => {
        fetchMentors();
      });
    }, [fetchMentors, fetchMentorMe, fetchMyGroups])
  );

  const openMentor = (mentor: Mentor) => {
    router.push(`/(home)/mentor-profile?userId=${mentor.userId}` as any);
  };

  const s = StyleSheet.create({
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
    queueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: 18,
      marginBottom: 20,
    },
    queueLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    queueIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    queueTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    queueSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 18 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 12,
    },
    mentorCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginRight: 14,
    },
    avatarText: { fontSize: 20, fontWeight: '800', color: colors.primary },
    info: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(241,132,45,0.12)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
    },
    verifiedText: { fontSize: 10, fontWeight: '700', color: '#F1842D' },
    headline: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    expertiseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    expertiseChip: {
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    expertiseText: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
    groupRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
    groupText: { fontSize: 11, color: colors.textSecondary, flexShrink: 1 },
    arrow: { alignSelf: 'center', marginLeft: 6 },
    loading: { paddingVertical: 80, alignItems: 'center' },
    empty: { paddingVertical: 60, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
    emptyText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 19,
      paddingHorizontal: 20,
    },
  });

  const getInitials = (name: string) => {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'M';
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
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
        <Text style={s.headerTitle}>Mentor Corner</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={mentorLoading && mentors.length === 0}
            onRefresh={() => {
              fetchMentors();
              fetchMentorMe();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {mentorMe.isMentor && (
          <TouchableOpacity
            style={s.queueCard}
            onPress={() => router.push('/(home)/mentor-questions' as any)}
            activeOpacity={0.85}
          >
            <View style={s.queueLeft}>
              <View style={s.queueIcon}>
                <Ionicons name="mail-unread" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={s.queueTitle}>Mentor Queue</Text>
                <Text style={s.queueSubtitle}>Review questions in your groups</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        <Text style={s.intro}>
          Connect with verified mentors from your communities. Ask a question and get guidance from an expert.
        </Text>

        {mentorLoading && mentors.length === 0 ? (
          <View style={s.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : mentors.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="school-outline" size={48} color={colors.textSecondary} />
            <Text style={s.emptyTitle}>No mentors available yet</Text>
            <Text style={s.emptyText}>
              Mentors assigned to your communities will appear here. Check back soon.
            </Text>
          </View>
        ) : (
          <>
            <Text style={s.sectionTitle}>Available Mentors</Text>
            {mentors.map((mentor) => (
              <TouchableOpacity
                key={mentor._id}
                style={s.mentorCard}
                onPress={() => openMentor(mentor)}
                activeOpacity={0.8}
              >
                <View style={s.avatar}>
                  {mentor.photoURL ? (
                    <Image source={{ uri: mentor.photoURL }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Text style={s.avatarText}>{getInitials(mentor.displayName)}</Text>
                  )}
                </View>

                <View style={s.info}>
                  <View style={s.nameRow}>
                    <Text style={s.name}>{mentor.displayName}</Text>
                    {mentor.isVerified && (
                      <View style={s.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={11} color="#F1842D" />
                        <Text style={s.verifiedText}>Verified</Text>
                      </View>
                    )}
                  </View>
                  {!!mentor.headline && <Text style={s.headline}>{mentor.headline}</Text>}

                  {(mentor.expertise || []).length > 0 && (
                    <View style={s.expertiseRow}>
                      {(mentor.expertise || []).slice(0, 3).map((item) => (
                        <View key={item} style={s.expertiseChip}>
                          <Text style={s.expertiseText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {(mentor.groups || []).length > 0 && (
                    <View style={s.groupRow}>
                      <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
                      <Text style={s.groupText} numberOfLines={1}>
                        {(mentor.groups || []).map((group) => group.name).join(', ')}
                      </Text>
                    </View>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={s.arrow} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
