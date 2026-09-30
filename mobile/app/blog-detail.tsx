import React, { useEffect } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity, StyleSheet, Share, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useBlogStore } from '../store/blogStore';
import { useTheme } from '../hooks/useTheme';

export default function BlogDetailScreen() {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 16,
  },
  backButtonInline: {
    backgroundColor: '#F1842D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonTextInline: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 15,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5C4A42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageContainer: {
    height: 280,
    width: '100%',
    backgroundColor: colors.surfaceSecondary,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    marginRight: 6,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 32,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  content: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 26,
    fontWeight: '400',
  },
});
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const blogId = (params.id as string) || '';

  const { currentBlog, fetchBlogById, isLoading, error, clearCurrentBlog } = useBlogStore();

  useEffect(() => {
    if (blogId) {
      fetchBlogById(blogId);
    }
    return () => {
      clearCurrentBlog();
    };
  }, [blogId, fetchBlogById, clearCurrentBlog]);

  const handleShare = async () => {
    if (!currentBlog) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const blogUrl = `paramsukh://blog-detail?id=${currentBlog._id}`;
    try {
      await Share.share({
        title: currentBlog.title,
        message: `${currentBlog.title}\n\n${currentBlog.excerpt || currentBlog.content.slice(0, 120)}...\n\n${blogUrl}`,
      });
    } catch (err) {
      console.error('Error sharing blog:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !currentBlog) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Blog not found'}</Text>
        <TouchableOpacity
          style={styles.backButtonInline}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonTextInline}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Overlay */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.circleButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.circleButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Featured Image */}
        <View style={styles.imageContainer}>
          {currentBlog.imageUrl ? (
            <Image source={{ uri: currentBlog.imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="document-text" size={64} color={colors.textSecondary} />
            </View>
          )}
        </View>

        {/* Content Wrapper */}
        <View style={styles.contentContainer}>
          {/* Metadata */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
              <Text style={styles.metaText}>{currentBlog.author}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
              <Text style={styles.metaText}>{formatDate(currentBlog.createdAt)}</Text>
            </View>
            {currentBlog.readTime && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
                <Text style={styles.metaText}>{currentBlog.readTime} min read</Text>
              </View>
            )}
          </View>

          {currentBlog.category && currentBlog.category !== 'Other' && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {currentBlog.category}
              </Text>
            </View>
          )}

          {/* Title */}
          <Text style={styles.title}>{currentBlog.title}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Body Content */}
          {currentBlog.excerpt && (
            <Text style={{ ...styles.content, fontStyle: 'italic', color: colors.textSecondary, marginBottom: 16 }}>
              {currentBlog.excerpt}
            </Text>
          )}
          <Text style={styles.content}>{currentBlog.content}</Text>
        </View>
      </ScrollView>
    </View>
  );
}


