import React, { useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useBlogStore, Blog } from '../store/blogStore';

export default function BlogsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { blogs, fetchBlogs, isLoading } = useBlogStore();

  useEffect(() => {
    fetchBlogs();
  }, [fetchBlogs]);

  const handlePressBlog = (blog: Blog) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/blog-detail',
      params: { id: blog._id }
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const renderBlogItem = ({ item }: { item: Blog }) => {
    return (
      <TouchableOpacity
        style={styles.blogCard}
        activeOpacity={0.8}
        onPress={() => handlePressBlog(item)}
      >
        <View style={styles.cardImageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="document-text" size={36} color="#8C7B73" />
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.blogTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.blogAuthor}>By {item.author}</Text>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.blogDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.blogSnippet} numberOfLines={3}>
            {item.content}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#2C2420" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Blogs</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Content */}
      {isLoading && blogs.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F1842D" />
        </View>
      ) : (
        <FlatList
          data={blogs}
          keyExtractor={(item) => item._id}
          renderItem={renderBlogItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchBlogs}
              tintColor="#F1842D"
              colors={['#F1842D']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color="#8C7B73" />
              <Text style={styles.emptyText}>No blog posts available</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF8F3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F3EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDF8F3',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2420',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  blogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#5C4A42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardImageContainer: {
    height: 180,
    width: '100%',
    backgroundColor: '#F4F3EB',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    padding: 20,
  },
  blogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2C2420',
    lineHeight: 24,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  blogAuthor: {
    fontSize: 12,
    color: '#8C7B73',
    fontWeight: '600',
  },
  bullet: {
    fontSize: 12,
    color: '#8C7B73',
    marginHorizontal: 8,
  },
  blogDate: {
    fontSize: 12,
    color: '#8C7B73',
    fontWeight: '600',
  },
  blogSnippet: {
    fontSize: 14,
    color: '#5C4A42',
    lineHeight: 20,
    fontWeight: '400',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#8C7B73',
    fontWeight: '600',
    marginTop: 12,
  },
});
