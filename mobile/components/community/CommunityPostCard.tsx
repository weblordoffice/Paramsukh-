import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Post } from '@/store/communityStore';

type Props = {
  post: Post;
  onLike: (postId: string) => void;
  onVote: (postId: string) => void;
  onComments: (post: Post) => void;
  onViewImages?: (images: string[], index: number) => void;
  onDelete?: (post: Post) => void;
};

export default function CommunityPostCard({
  post,
  onLike,
  onVote,
  onComments,
  onViewImages,
  onDelete,
}: Props) {
  const { colors } = useTheme();
  const isQuestion = post.postType === 'question';
  const isMentorPost = post.postType === 'mentor';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}>
          {post.author?.photoURL ? (
            <Image source={{ uri: post.author.photoURL }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {post.author?.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {post.author?.displayName || 'User'}
            </Text>
            {post.author?.isMentor ? (
              <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>Mentor</Text>
              </View>
            ) : null}
            {isMentorPost ? (
              <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>Update</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            {new Date(post.createdAt).toLocaleDateString()}
          </Text>
        </View>
        {onDelete ? (
          <TouchableOpacity onPress={() => onDelete(post)} style={styles.menuButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {isQuestion && (
        <>
          {post.isResolved ? (
            <View style={styles.resolvedBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#2E7D32" />
              <Text style={styles.resolvedText}>Resolved</Text>
            </View>
          ) : null}
          {post.title ? (
            <Text style={[styles.title, { color: colors.text }]}>{post.title}</Text>
          ) : null}
        </>
      )}

      <Text style={[styles.content, { color: colors.text }]}>{post.content}</Text>

      {post.tags?.length ? (
        <View style={styles.tags}>
          {post.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {post.images?.[0] ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onViewImages?.(post.images || [], 0)}
        >
          <Image source={{ uri: post.images[0] }} style={styles.image} />
          {post.images.length > 1 ? (
            <View style={styles.imageCount}>
              <Ionicons name="images-outline" size={12} color="#FFFFFF" />
              <Text style={styles.imageCountText}>{post.images.length}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ) : null}

      <View style={styles.actions}>
        {isQuestion ? (
          <TouchableOpacity style={styles.action} onPress={() => onVote(post._id)}>
            <Ionicons
              name={post.userVoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
              size={21}
              color={post.userVoted ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.actionText, { color: post.userVoted ? colors.primary : colors.textSecondary }]}>
              {post.voteCount || 0}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.action} onPress={() => onLike(post._id)}>
            <Ionicons
              name={post.userLiked ? 'heart' : 'heart-outline'}
              size={21}
              color={post.userLiked ? '#EF4444' : colors.textSecondary}
            />
            <Text style={[styles.actionText, { color: post.userLiked ? '#EF4444' : colors.textSecondary }]}>
              {post.likeCount}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.action} onPress={() => onComments(post)}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>{post.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { flexShrink: 1, fontSize: 14, fontWeight: '800' },
  badge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  date: { fontSize: 10, marginTop: 2 },
  menuButton: { padding: 4 },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  resolvedText: { fontSize: 10, fontWeight: '700', color: '#2E7D32' },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  content: { fontSize: 14, lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 10, fontWeight: '600' },
  image: { width: '100%', height: 190, borderRadius: 10, marginTop: 10 },
  imageCount: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  imageCountText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: 22, marginTop: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 12, fontWeight: '700' },
});
