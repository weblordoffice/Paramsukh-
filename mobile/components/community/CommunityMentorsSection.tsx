import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import {
  useCommunityStore,
  Group,
  Mentor,
  Post,
} from '@/store/communityStore';
import CreateMentorPostModal from './CreateMentorPostModal';

type Props = {
  activeGroup: Group | null;
  onSelectGroup: (group: Group | null) => void;
  onOpenComments: (post: Post) => void;
};

export default function CommunityMentorsSection({
  activeGroup,
  onSelectGroup,
  onOpenComments,
}: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const mentors = useCommunityStore((state) => state.mentors);
  const groups = useCommunityStore((state) => state.groups);
  const mentorPosts = useCommunityStore((state) => state.mentorPosts);
  const mentorMe = useCommunityStore((state) => state.mentorMe);
  const mentorLoading = useCommunityStore((state) => state.mentorLoading);
  const mentorPostsLoading = useCommunityStore((state) => state.mentorPostsLoading);
  const ownedGroups = useCommunityStore((state) => state.ownedGroups);
  const fetchMentors = useCommunityStore((state) => state.fetchMentors);
  const fetchMentorPosts = useCommunityStore((state) => state.fetchMentorPosts);
  const togglePostLike = useCommunityStore((state) => state.togglePostLike);

  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const groupOptions = useMemo(() => {
    const byId = new Map<string, Group>();
    groups.forEach((group) => {
      if (group?._id) byId.set(group._id, group);
    });
    if (activeGroup?._id) byId.set(activeGroup._id, activeGroup);
    return [...byId.values()];
  }, [groups, activeGroup]);

  const load = useCallback(async () => {
    const groupId = activeGroup?._id;
    await Promise.all([
      fetchMentors(groupId),
      fetchMentorPosts({ groupId, page: 1 }),
    ]);
  }, [activeGroup?._id, fetchMentors, fetchMentorPosts]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openMentor = (mentor: Mentor) => {
    router.push(`/(home)/mentor-profile?userId=${mentor.userId}` as any);
  };

  const defaultGroupId = activeGroup?._id || ownedGroups[0]?._id || null;

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: !activeGroup ? colors.primary : colors.surface, borderColor: colors.border },
            ]}
            onPress={() => onSelectGroup(null)}
          >
            <Ionicons name="people-outline" size={13} color={!activeGroup ? '#FFFFFF' : colors.textSecondary} />
            <Text style={[styles.filterText, { color: !activeGroup ? '#FFFFFF' : colors.textSecondary }]}>
              All my communities
            </Text>
          </TouchableOpacity>
          {groupOptions.map((group) => {
            const active = activeGroup?._id === group._id;
            return (
              <TouchableOpacity
                key={group._id}
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? colors.primary : colors.surface, borderColor: colors.border },
                ]}
                onPress={() => onSelectGroup(group)}
              >
                <Ionicons
                  name={group.groupType === 'mentor' ? 'lock-closed-outline' : 'people-outline'}
                  size={13}
                  color={active ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[styles.filterText, { color: active ? '#FFFFFF' : colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {group.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {mentorMe.isMentor ? (
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowCreate(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={19} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Create Mentor Post</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {activeGroup ? `Mentors in ${activeGroup.name}` : 'Your Mentors'}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {mentors.length}
          </Text>
        </View>

        {mentorLoading && mentors.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : mentors.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="school-outline" size={30} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No mentors yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Mentors assigned to your communities will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mentorRow}
          >
            {mentors.map((mentor) => (
              <TouchableOpacity
                key={mentor._id}
                style={[styles.mentorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => openMentor(mentor)}
                activeOpacity={0.85}
              >
                <View style={[styles.mentorAvatar, { backgroundColor: colors.surfaceSecondary }]}>
                  {mentor.photoURL ? (
                    <Image source={{ uri: mentor.photoURL }} style={styles.mentorAvatarImage} />
                  ) : (
                    <Text style={[styles.mentorAvatarText, { color: colors.primary }]}>
                      {mentor.displayName?.charAt(0)?.toUpperCase() || 'M'}
                    </Text>
                  )}
                </View>
                <View style={styles.verifiedRow}>
                  <Text style={[styles.mentorName, { color: colors.text }]} numberOfLines={1}>
                    {mentor.displayName}
                  </Text>
                  <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                </View>
                <Text style={[styles.mentorHeadline, { color: colors.textSecondary }]} numberOfLines={2}>
                  {mentor.headline || 'Community mentor'}
                </Text>
                <Text style={[styles.mentorGroups, { color: colors.primary }]} numberOfLines={1}>
                  {mentor.groups?.length ? `${mentor.groups.length} group${mentor.groups.length === 1 ? '' : 's'}` : 'Mentor'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mentor Posts</Text>
        </View>

        {mentorPostsLoading && mentorPosts.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : mentorPosts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No mentor posts yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Guidance shared by your mentors will appear here.
            </Text>
          </View>
        ) : (
          mentorPosts.map((post) => (
            <View
              key={post._id}
              style={[styles.postCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.postHeader}>
                <View style={[styles.postAvatar, { backgroundColor: colors.surfaceSecondary }]}>
                  {post.author?.photoURL ? (
                    <Image source={{ uri: post.author.photoURL }} style={styles.mentorAvatarImage} />
                  ) : (
                    <Text style={[styles.postAvatarText, { color: colors.primary }]}>
                      {post.author?.displayName?.charAt(0)?.toUpperCase() || 'M'}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.verifiedRow}>
                    <Text style={[styles.postAuthor, { color: colors.text }]} numberOfLines={1}>
                      {post.author?.displayName || 'Mentor'}
                    </Text>
                    <View style={[styles.mentorBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Text style={[styles.mentorBadgeText, { color: colors.primary }]}>Mentor</Text>
                    </View>
                  </View>
                  <Text style={[styles.postDate, { color: colors.textSecondary }]}>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              <Text style={[styles.postContent, { color: colors.text }]}>{post.content}</Text>

              {post.images?.[0] ? (
                <Image source={{ uri: post.images[0] }} style={styles.postImage} />
              ) : null}

              <View style={styles.postActions}>
                <TouchableOpacity style={styles.postAction} onPress={() => togglePostLike(post._id)}>
                  <Ionicons
                    name={post.userLiked ? 'heart' : 'heart-outline'}
                    size={20}
                    color={post.userLiked ? '#EF4444' : colors.textSecondary}
                  />
                  <Text style={[styles.postActionText, { color: colors.textSecondary }]}>
                    {post.likeCount}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postAction} onPress={() => onOpenComments(post)}>
                  <Ionicons name="chatbubble-outline" size={19} color={colors.textSecondary} />
                  <Text style={[styles.postActionText, { color: colors.textSecondary }]}>
                    {post.commentCount}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <CreateMentorPostModal
        visible={showCreate}
        defaultGroupId={defaultGroupId}
        onClose={() => setShowCreate(false)}
        onCreated={load}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  filterRow: { gap: 8, paddingBottom: 14 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 220,
  },
  filterText: { fontSize: 11, fontWeight: '700', maxWidth: 170 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    paddingVertical: 13,
    marginBottom: 20,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionCount: { fontSize: 12, fontWeight: '700' },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyText: { fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  mentorRow: { gap: 10, paddingBottom: 22 },
  mentorCard: {
    width: 190,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  mentorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  mentorAvatarImage: { width: '100%', height: '100%' },
  mentorAvatarText: { fontSize: 17, fontWeight: '800' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mentorName: { flexShrink: 1, fontSize: 14, fontWeight: '800' },
  mentorHeadline: { fontSize: 11, lineHeight: 16, marginTop: 4, minHeight: 32 },
  mentorGroups: { fontSize: 10, fontWeight: '700', marginTop: 8 },
  postCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  postAvatarText: { fontSize: 15, fontWeight: '800' },
  postAuthor: { flexShrink: 1, fontSize: 14, fontWeight: '800' },
  mentorBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  mentorBadgeText: { fontSize: 9, fontWeight: '800' },
  postDate: { fontSize: 10, marginTop: 2 },
  postContent: { fontSize: 14, lineHeight: 21 },
  postImage: { width: '100%', height: 190, borderRadius: 10, marginTop: 10 },
  postActions: { flexDirection: 'row', gap: 20, marginTop: 12 },
  postAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postActionText: { fontSize: 12, fontWeight: '700' },
});
