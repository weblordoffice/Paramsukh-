import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useBlogStore, Blog } from '../store/blogStore';
import { useTheme } from '../hooks/useTheme';

const BLOGS_CACHE_KEY = 'blogs_cache';
const CATEGORIES_CACHE_KEY = 'blog_categories_cache';
const CACHE_TTL_MS = 5 * 60 * 1000;

export default function BlogsScreen() {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
      borderBottomColor: colors.border, backgroundColor: colors.surface,
    },
    backButton: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center',
      justifyContent: 'center', backgroundColor: colors.background,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    headerRightPlaceholder: { width: 40 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    categoryContainer: {
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    categoryScroll: { paddingHorizontal: 16, paddingVertical: 12 },
    categoryChipActive: {
      paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginRight: 8,
      backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary,
    },
    categoryChipInactive: {
      paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginRight: 8,
      backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    },
    categoryChipTextActive: { fontSize: 13, fontWeight: '600', color: colors.surface },
    categoryChipTextInactive: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    listContent: { padding: 20, paddingBottom: 40 },
    blogCard: {
      backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden',
      marginBottom: 20, shadowColor: '#5C4A42', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
    },
    cardImageContainer: { height: 180, width: '100%', backgroundColor: colors.surfaceSecondary },
    cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    placeholderImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    cardContent: { padding: 20 },
    blogTitle: { fontSize: 18, fontWeight: '800', color: colors.text, lineHeight: 24, marginBottom: 8 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    blogAuthor: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    bullet: { fontSize: 12, color: colors.textSecondary, marginHorizontal: 8 },
    blogDate: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    blogSnippet: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, fontWeight: '400' },
    readTimeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    readTime: { fontSize: 12, color: colors.primary, fontWeight: '600', marginLeft: 4 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 15, color: colors.textSecondary, fontWeight: '600', marginTop: 12 },
    loadMoreContainer: { paddingVertical: 20, alignItems: 'center' },
    footerSpinner: { paddingVertical: 20 },
  });

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    blogs, categories, fetchBlogs, fetchCategories, fetchMoreBlogs,
    isLoading, isLoadingMore, hasMore, selectedCategory, setCategory,
    getCachedBlogs,
  } = useBlogStore();

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      await Promise.all([getCachedBlogs(), fetchCategories()]);
      await fetchBlogs(false);
      setInitialized(true);
    };
    void init();
  }, []);

  const handleSelectCategory = useCallback((cat: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCategory(cat);
  }, [setCategory]);

  useEffect(() => {
    if (initialized) {
      void fetchBlogs(true);
    }
  }, [selectedCategory]);

  const handlePressBlog = (blog: Blog) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/blog-detail', params: { id: blog._id } });
  };

  const handleRefresh = () => { void fetchBlogs(true); };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const renderBlogItem = ({ item }: { item: Blog }) => (
    <TouchableOpacity style={styles.blogCard} activeOpacity={0.8} onPress={() => handlePressBlog(item)}>
      <View style={styles.cardImageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="document-text" size={36} color={colors.textSecondary} />
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        {item.category && item.category !== 'Other' && (
          <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
            {item.category}
          </Text>
        )}
        <Text style={styles.blogTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.blogAuthor}>By {item.author}</Text>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.blogDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text style={styles.blogSnippet} numberOfLines={3}>
          {item.excerpt || item.content}
        </Text>
        {item.readTime && (
          <View style={styles.readTimeRow}>
            <Ionicons name="time-outline" size={13} color={colors.primary} />
            <Text style={styles.readTime}>{item.readTime} min read</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerSpinner}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Blogs</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {categories.length > 1 && (
        <View style={styles.categoryContainer}>
          <FlatList
            horizontal
            data={categories}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
            renderItem={({ item }) => {
              const selected = selectedCategory === item;
              return (
                <TouchableOpacity
                  style={selected ? styles.categoryChipActive : styles.categoryChipInactive}
                  onPress={() => handleSelectCategory(item)}
                >
                  <Text style={selected ? styles.categoryChipTextActive : styles.categoryChipTextInactive}>{item}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {isLoading && blogs.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={blogs}
          keyExtractor={(item) => item._id}
          renderItem={renderBlogItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
          onEndReached={() => { if (hasMore && !isLoadingMore) void fetchMoreBlogs(); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No blog posts available</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
