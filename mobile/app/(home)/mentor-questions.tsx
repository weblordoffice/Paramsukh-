import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import CommentsModal from '@/components/CommentsModal';
import {
  useCommunityStore,
  MentorQuestionFilter,
  Post,
} from '@/store/communityStore';

export default function MentorQuestionsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [status, setStatus] = useState<MentorQuestionFilter>('all');
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);

  const {
    mentorQuestions,
    mentorLoading,
    mentorError,
    fetchMentorQuestions,
  } = useCommunityStore();

  const load = useCallback(() => {
    fetchMentorQuestions({ status, assigned: assignedOnly });
  }, [assignedOnly, fetchMentorQuestions, status]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const statusTabs = useMemo(() => ([
    { key: 'all' as MentorQuestionFilter, label: 'All' },
    { key: 'unanswered' as MentorQuestionFilter, label: 'Unanswered' },
    { key: 'resolved' as MentorQuestionFilter, label: 'Resolved' },
  ]), []);

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
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    filters: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 4,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
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
    assignedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      alignSelf: 'flex-start',
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    checkboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    assignedText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    listContent: { padding: 20, paddingBottom: 40 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    resolvedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#E8F5E9',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    openBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#FFF3E0',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    badgeTextOpen: { fontSize: 10, fontWeight: '700', color: '#E65100' },
    badgeTextResolved: { fontSize: 10, fontWeight: '700', color: '#2E7D32' },
    title: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 },
    body: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
    metaText: { fontSize: 11, color: colors.textSecondary },
    assignedTag: {
      backgroundColor: colors.primary + '12',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
    },
    assignedTagText: { fontSize: 10, fontWeight: '700', color: colors.primary },
    loading: { paddingVertical: 80, alignItems: 'center' },
    empty: { paddingVertical: 60, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
  });

  const activePostForModal = activePost
    ? mentorQuestions.find((question) => question._id === activePost._id) || activePost
    : null;

  const renderQuestion = ({ item }: { item: Post }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.8}
      onPress={() => setActivePost(item)}
    >
      <View style={s.cardHeader}>
        <View style={item.isResolved ? s.resolvedBadge : s.openBadge}>
          <Ionicons
            name={item.isResolved ? 'checkmark-circle' : 'time-outline'}
            size={11}
            color={item.isResolved ? '#2E7D32' : '#E65100'}
          />
          <Text style={item.isResolved ? s.badgeTextResolved : s.badgeTextOpen}>
            {item.isResolved ? 'Resolved' : 'Open'}
          </Text>
        </View>
        {item.assignedMentorId && (
          <View style={s.assignedTag}>
            <Text style={s.assignedTagText}>Assigned</Text>
          </View>
        )}
      </View>

      <Text style={s.title} numberOfLines={2}>{item.title || 'Question'}</Text>
      <Text style={s.body} numberOfLines={3}>{item.content}</Text>

      <View style={s.metaRow}>
        <Text style={s.metaText}>{item.author?.displayName || 'Member'}</Text>
        <Text style={s.metaText}>{item.commentCount || 0} answers</Text>
        <Text style={s.metaText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => { if (router.canGoBack()) router.back(); else router.push('/(home)/community'); }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mentor Queue</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.filters}>
        <View style={s.tabs}>
          {statusTabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, status === tab.key && s.tabActive]}
              onPress={() => setStatus(tab.key)}
            >
              <Text style={[s.tabText, status === tab.key && s.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={s.assignedToggle}
          onPress={() => setAssignedOnly((prev) => !prev)}
          activeOpacity={0.8}
        >
          <View style={[s.checkbox, assignedOnly && s.checkboxActive]}>
            {assignedOnly && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
          <Text style={s.assignedText}>Only questions assigned to me</Text>
        </TouchableOpacity>
      </View>

      {mentorLoading && mentorQuestions.length === 0 ? (
        <View style={s.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={mentorQuestions}
          keyExtractor={(item) => item._id}
          renderItem={renderQuestion}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={mentorLoading} onRefresh={load} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons
                name={mentorError === 'NOT_A_MENTOR' ? 'lock-closed-outline' : 'checkmark-done-outline'}
                size={48}
                color={colors.textSecondary}
              />
              <Text style={s.emptyTitle}>
                {mentorError === 'NOT_A_MENTOR' ? 'Mentor access only' : 'No questions here'}
              </Text>
              <Text style={s.emptyText}>
                {mentorError === 'NOT_A_MENTOR'
                  ? 'Your account is not set up as a mentor. Contact an administrator if this is unexpected.'
                  : 'Questions from your assigned groups will appear here.'}
              </Text>
            </View>
          }
        />
      )}

      <CommentsModal
        visible={activePost !== null}
        postId={activePost?._id || null}
        post={activePostForModal}
        onClose={() => {
          setActivePost(null);
          load();
        }}
      />
    </SafeAreaView>
  );
}
