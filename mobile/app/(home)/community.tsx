import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useTheme } from '../../hooks/useTheme';
import CommentsModal from '@/components/CommentsModal';
import ImageViewerModal from '@/components/ImageViewerModal';
import CommunityPostCard from '@/components/community/CommunityPostCard';
import CommunityComposerModal from '@/components/community/CommunityComposerModal';
import CommunityGroupSelector from '@/components/community/CommunityGroupSelector';
import CommunityGroupsSection from '@/components/community/CommunityGroupsSection';
import CommunityMentorsSection from '@/components/community/CommunityMentorsSection';
import {
  useCommunityStore,
  Group,
  Post,
  QuestionFilter,
} from '@/store/communityStore';

type CommunityTab = 'discussion' | 'question' | 'mentors' | 'groups';

const TABS: { key: CommunityTab; label: string }[] = [
  { key: 'discussion', label: 'Discussion' },
  { key: 'question', label: 'Questions' },
  { key: 'mentors', label: 'Mentors' },
  { key: 'groups', label: 'Groups' },
];

const QUESTION_FILTERS: { key: QuestionFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unanswered', label: 'Unanswered' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'mine', label: 'My Questions' },
];

export default function CommunityScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useNotificationStore();

  const {
    posts,
    groups,
    planGroups,
    mentorGroups,
    ownedGroups,
    mentorMemberGroups,
    generalGroup,
    isLoading,
    fetchMyGroups,
    fetchGroupPosts,
    fetchAllPosts,
    deletePost,
    togglePostLike,
    votePost,
    postingBlocked,
    mentorMe,
    fetchMentorMe,
  } = useCommunityStore();

  const [activeTab, setActiveTab] = useState<CommunityTab>('discussion');
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>('all');
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [viewer, setViewer] = useState({ visible: false, images: [] as string[], index: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isFeed = activeTab === 'discussion' || activeTab === 'question';

  useFocusEffect(
    useCallback(() => {
      fetchMyGroups();
      fetchMentorMe();
      fetchUnreadCount();
    }, [fetchMyGroups, fetchMentorMe, fetchUnreadCount])
  );

  const loadFeed = useCallback((page = 1) => {
    const postType = activeTab === 'question' ? 'question' : 'discussion';
    if (activeGroup) {
      return fetchGroupPosts(activeGroup._id, page, postType, questionFilter);
    }
    return fetchAllPosts(page, postType, questionFilter);
  }, [activeGroup, activeTab, questionFilter, fetchGroupPosts, fetchAllPosts]);

  useEffect(() => {
    if (!isFeed) return;
    setCurrentPage(1);
    loadFeed(1);
  }, [isFeed, activeGroup?._id, activeTab, questionFilter, loadFeed]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMyGroups(), loadFeed(1)]);
    setRefreshing(false);
  };

  const confirmDelete = (post: Post) => {
    Alert.alert('Delete Post', 'Delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePost(post._id) },
    ]);
  };

  const selectGroup = (group: Group | null) => {
    setActiveGroup(group);
    setCurrentPage(1);
  };

  const groupLabel = activeGroup?.name || 'All Communities';
  const notificationBadge = unreadCount > 99 ? '99+' : String(unreadCount);

  const selectorGroups = useMemo(() => {
    const byId = new Map<string, Group>();
    groups.forEach((group) => {
      if (group?._id) byId.set(group._id, group);
    });
    return [...byId.values()];
  }, [groups]);

  const feedComposerGroups = activeGroup
    ? [activeGroup]
    : generalGroup
      ? [generalGroup]
      : [];

  const activePost = commentPost;

  const renderFeedHeader = () => (
    <View>
      {activeTab === 'question' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {QUESTION_FILTERS.map((filter) => {
            const active = questionFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? colors.primary : colors.surface, borderColor: colors.border },
                ]}
                onPress={() => setQuestionFilter(filter.key)}
              >
                <Text style={[styles.filterText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <TouchableOpacity
        style={[styles.composerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          if (postingBlocked) {
            Alert.alert('Posting blocked', 'An administrator has blocked you from posting.');
            return;
          }
          setShowComposer(true);
        }}
      >
        <Ionicons
          name={postingBlocked ? 'ban' : 'add-circle'}
          size={23}
          color={postingBlocked ? colors.textSecondary : colors.primary}
        />
        <Text style={[styles.composerText, { color: colors.textSecondary }]}>
          {postingBlocked
            ? 'You are blocked from posting'
            : activeTab === 'question'
              ? 'Ask the community a question...'
              : 'Share something with the community...'}
        </Text>
        <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <Text style={[styles.listTitle, { color: colors.text }]}>
        {activeTab === 'question' ? 'Questions' : 'Recent Posts'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === 'ios' ? 50 : 40,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Community</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Discuss, ask, learn from mentors
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            onPress={() => router.push('/(home)/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{notificationBadge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            onPress={() => router.push('/profile-menu')}
          >
            <Text style={[styles.profileInitial, { color: colors.primary }]}>
              {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.surfaceSecondary }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && { backgroundColor: colors.surface }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab !== 'groups' ? (
        <TouchableOpacity
          style={[styles.groupSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowGroupSelector(true)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeGroup?.groupType === 'mentor' ? 'lock-closed-outline' : 'people-outline'}
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.groupSelectorText, { color: colors.text }]} numberOfLines={1}>
            {groupLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}

      {activeTab === 'groups' ? (
        <CommunityGroupsSection
          generalGroup={generalGroup}
          planGroups={planGroups}
          mentorGroups={mentorGroups}
          ownedGroups={ownedGroups}
          mentorMemberGroups={mentorMemberGroups}
          isMentor={mentorMe.isMentor}
          onOpenGroup={(group) => {
            setActiveGroup(group);
            setActiveTab('discussion');
          }}
          onChanged={fetchMyGroups}
        />
      ) : activeTab === 'mentors' ? (
        <CommunityMentorsSection
          activeGroup={activeGroup}
          onOpenComments={setCommentPost}
          onViewImages={(images, index) => setViewer({ visible: true, images, index })}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
          }
          ListHeaderComponent={renderFeedHeader}
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {activeTab === 'question' ? 'No questions yet' : 'No posts yet'}
                </Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {activeTab === 'question'
                    ? 'Be the first to ask the community.'
                    : 'Start the conversation.'}
                </Text>
              </View>
            )
          }
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (loadingMore || isLoading) return;
            setLoadingMore(true);
            const nextPage = currentPage + 1;
            loadFeed(nextPage)
              .then(() => setCurrentPage(nextPage))
              .finally(() => setLoadingMore(false));
          }}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} /> : null
          }
          renderItem={({ item }) => (
            <CommunityPostCard
              post={item}
              onLike={togglePostLike}
              onVote={votePost}
              onComments={setCommentPost}
              onViewImages={(images, index) => setViewer({ visible: true, images, index })}
              onDelete={item.author?._id === user?._id ? confirmDelete : undefined}
            />
          )}
        />
      )}

      <CommunityGroupSelector
        visible={showGroupSelector}
        groups={selectorGroups}
        activeGroup={activeGroup}
        onSelect={selectGroup}
        onClose={() => setShowGroupSelector(false)}
      />

      <CommunityComposerModal
        visible={showComposer}
        allowedTypes={['discussion', 'question']}
        groups={feedComposerGroups}
        initialGroupId={activeGroup?._id || generalGroup?._id || null}
        initialType={activeTab === 'question' ? 'question' : 'discussion'}
        onClose={() => setShowComposer(false)}
        onCreated={() => loadFeed(1)}
      />

      <CommentsModal
        visible={!!activePost}
        postId={activePost?._id || null}
        post={activePost}
        onClose={() => setCommentPost(null)}
      />

      <ImageViewerModal
        visible={viewer.visible}
        images={viewer.images}
        initialIndex={viewer.index}
        onClose={() => setViewer((current) => ({ ...current, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 21, fontWeight: '800' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { fontSize: 16, fontWeight: '800' },
  notificationBadge: {
    position: 'absolute',
    top: 5,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: { fontSize: 8, fontWeight: '800', color: '#FFFFFF' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 11,
    padding: 3,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  tabText: { fontSize: 11, fontWeight: '800' },
  groupSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupSelectorText: { flex: 1, fontSize: 13, fontWeight: '700' },
  filterRow: { gap: 8, paddingHorizontal: 20, paddingTop: 14 },
  filterChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  filterText: { fontSize: 11, fontWeight: '700' },
  composerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  composerText: { flex: 1, fontSize: 13 },
  listTitle: { fontSize: 13, fontWeight: '800', marginHorizontal: 20, marginTop: 18, marginBottom: 10 },
  empty: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 10 },
  emptyText: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
