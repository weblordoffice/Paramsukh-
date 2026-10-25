import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import {
  useCommunityStore,
  Group,
  Mentor,
  Post,
} from '@/store/communityStore';
import CommunityComposerModal from './CommunityComposerModal';
import CommunityPostCard from './CommunityPostCard';

type Props = {
  activeGroup: Group | null;
  onOpenComments: (post: Post) => void;
  onViewImages: (images: string[], index: number) => void;
};

export default function CommunityMentorsSection({
  activeGroup,
  onOpenComments,
  onViewImages,
}: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const mentors = useCommunityStore((state) => state.mentors);
  const mentorPosts = useCommunityStore((state) => state.mentorPosts);
  const mentorMe = useCommunityStore((state) => state.mentorMe);
  const mentorLoading = useCommunityStore((state) => state.mentorLoading);
  const mentorPostsLoading = useCommunityStore((state) => state.mentorPostsLoading);
  const mentorGroups = useCommunityStore((state) => state.mentorGroups);
  const ownedGroups = useCommunityStore((state) => state.ownedGroups);
  const fetchMentors = useCommunityStore((state) => state.fetchMentors);
  const fetchMentorPosts = useCommunityStore((state) => state.fetchMentorPosts);
  const togglePostLike = useCommunityStore((state) => state.togglePostLike);
  const deletePost = useCommunityStore((state) => state.deletePost);

  const [showComposer, setShowComposer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const composerGroups = useMemo(() => {
    const byId = new Map<string, Group>();
    [...ownedGroups, ...mentorGroups].forEach((group) => {
      if (group?._id) byId.set(group._id, group);
    });
    return [...byId.values()];
  }, [mentorGroups, ownedGroups]);

  const initialGroupId = activeGroup && composerGroups.some((group) => group._id === activeGroup._id)
    ? activeGroup._id
    : composerGroups[0]?._id || null;

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

  const confirmDelete = (post: Post) => {
    Alert.alert('Delete Post', 'Delete this mentor post?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePost(post._id) },
    ]);
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        {mentorMe.isMentor ? (
          <>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowComposer(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={19} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create Mentor Post</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.queueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(home)/mentor-questions' as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="mail-unread-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.queueTitle, { color: colors.text }]}>Mentor Queue</Text>
                <Text style={[styles.queueText, { color: colors.textSecondary }]}>
                  Review questions in your groups
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {activeGroup ? `Mentors in ${activeGroup.name}` : 'Your Mentors'}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>{mentors.length}</Text>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mentorRow}>
            {mentors.map((mentor) => (
              <TouchableOpacity
                key={mentor._id}
                style={[styles.mentorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => openMentor(mentor)}
                activeOpacity={0.85}
              >
                <View style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}>
                  {mentor.photoURL ? (
                    <Image source={{ uri: mentor.photoURL }} style={styles.avatarImage} />
                  ) : (
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {mentor.displayName?.charAt(0)?.toUpperCase() || 'M'}
                    </Text>
                  )}
                </View>
                <View style={styles.nameRow}>
                  <Text style={[styles.mentorName, { color: colors.text }]} numberOfLines={1}>
                    {mentor.displayName}
                  </Text>
                  <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                </View>
                <Text style={[styles.headline, { color: colors.textSecondary }]} numberOfLines={2}>
                  {mentor.headline || 'Community mentor'}
                </Text>
                <Text style={[styles.groupCount, { color: colors.primary }]} numberOfLines={1}>
                  {mentor.groups?.length
                    ? `${mentor.groups.length} group${mentor.groups.length === 1 ? '' : 's'}`
                    : 'Mentor'}
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
            <CommunityPostCard
              key={post._id}
              post={post}
              onLike={togglePostLike}
              onVote={togglePostLike}
              onComments={onOpenComments}
              onViewImages={onViewImages}
              onDelete={post.author?._id === user?._id ? confirmDelete : undefined}
            />
          ))
        )}
      </ScrollView>

      <CommunityComposerModal
        visible={showComposer}
        allowedTypes={['mentor']}
        groups={composerGroups}
        initialGroupId={initialGroupId}
        initialType="mentor"
        onClose={() => setShowComposer(false)}
        onCreated={load}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 14, paddingBottom: 40 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    paddingVertical: 13,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  queueTitle: { fontSize: 13, fontWeight: '800' },
  queueText: { fontSize: 11, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
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
    marginHorizontal: 20,
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyText: { fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  mentorRow: { gap: 10, paddingHorizontal: 20, paddingBottom: 22 },
  mentorCard: {
    width: 190,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 17, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mentorName: { flexShrink: 1, fontSize: 14, fontWeight: '800' },
  headline: { fontSize: 11, lineHeight: 16, marginTop: 4, minHeight: 32 },
  groupCount: { fontSize: 10, fontWeight: '700', marginTop: 8 },
});
