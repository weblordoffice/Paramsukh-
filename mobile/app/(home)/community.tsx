import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Image,
  Alert,
  Animated,
  Dimensions,
  Platform,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';
import AssessmentModal from '@/components/AssessmentModal';
import CommentsModal from '@/components/CommentsModal';
import * as ImagePicker from 'expo-image-picker';
import { useCommunityStore, Group } from '@/store/communityStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.75;

type ViewType = 'feed' | 'groups' | 'message';

export default function CommunityScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    posts,
    groups,
    isLoading: isStoreLoading,
    fetchMyGroups,
    fetchGroupPosts,
    createPost: storeCreatePost,
    togglePostLike: storeToggleLike
  } = useCommunityStore();

  const [activeGroup, setActiveGroup] = useState<Group | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('feed');
  const [postType, setPostType] = useState<'feed' | 'channel'>('feed');
  const [showPostTypeFilter, setShowPostTypeFilter] = useState(false);
  const [selectedPostFilter, setSelectedPostFilter] = useState<'all' | 'image' | 'video' | 'audio' | 'text'>('all');
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [createPostTags, setCreatePostTags] = useState<string[]>([]);
  const sidebarAnimation = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  // Get user's initials
  const getUserInitial = () => {
    if (user?.displayName) {
      const name = user.displayName.trim();
      const words = name.split(/\s+/).filter(word => word.length > 0);
      if (words.length === 0) return 'U';
      if (words.length === 1) return words[0].charAt(0).toUpperCase();
      return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }
    return 'U';
  };

  const navigateToProfile = () => {
    router.push('/profile-menu');
  };

  const navigateToNotifications = () => {
    router.push('/(home)/notifications');
  };

  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  const [showPostTypeSelector, setShowPostTypeSelector] = useState(false);

  useEffect(() => {
    checkAssessmentStatus();
    // Fetch user groups on mount
    fetchMyGroups();
  }, []);

  // When groups are loaded, auto-select first group for now (or 'All' if backend supports global feed)
  useEffect(() => {
    if (groups.length > 0 && !activeGroup) {
      setActiveGroup(groups[0]);
    }
  }, [groups]);

  // When active group changes, fetch its posts
  useEffect(() => {
    if (activeGroup) {
      fetchGroupPosts(activeGroup._id);
    }
  }, [activeGroup]);

  useEffect(() => {
    Animated.timing(sidebarAnimation, {
      toValue: showSidebar ? 0 : -SIDEBAR_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showSidebar]);

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    setShowSidebar(false);
  };
  const checkAssessmentStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem('assessment_completed');
      setAssessmentCompleted(completed === 'true');
    } catch (error) {
      console.error('Error checking assessment status:', error);
    }
  };

  const handleAssessmentComplete = async (answers: Record<string, string | boolean>) => {
    try {
      await AsyncStorage.setItem('assessment_completed', 'true');
      await AsyncStorage.setItem('assessment_answers', JSON.stringify(answers));
      setAssessmentCompleted(true);
      setShowAssessment(false);
      console.log('Assessment completed:', answers);
    } catch (error) {
      console.error('Error saving assessment:', error);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedMedia(result.assets[0].uri);
        setMediaType('image');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handlePickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your videos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedMedia(result.assets[0].uri);
        setMediaType('video');
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const publishPost = async (type: 'feed' | 'channel') => {
    if (!activeGroup) {
      Alert.alert('Error', 'No active group selected to post to.');
      return;
    }

    try {
      setIsLoading(true);
      let uploadedImageUrls: string[] = [];

      // Upload media to Cloudinary if present
      if (selectedMedia && mediaType) {
        const uploadedUrl = await useCommunityStore.getState().uploadMedia(selectedMedia, mediaType);

        if (uploadedUrl) {
          uploadedImageUrls = [uploadedUrl];
        } else {
          Alert.alert('Upload Failed', 'Failed to upload media. Please try again.');
          setIsLoading(false);
          return;
        }
      }

      const success = await storeCreatePost(
        activeGroup._id,
        postContent,
        uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
        createPostTags
      );

      if (success) {
        setPostContent('');
        setSelectedMedia(null);
        setMediaType(null);
        setCreatePostTags([]);
        setPostType('feed');
        setShowCreatePost(false);
        setShowPostTypeSelector(false);
        setIsLoading(false);

        Alert.alert('Success', 'Your post has been published!');
      } else {
        setIsLoading(false);
        Alert.alert('Error', 'Failed to publish post');
      }
    } catch (error) {
      console.error('Publish Error:', error);
      setIsLoading(false);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleCreatePost = () => {
    if (!postContent.trim() && !selectedMedia) {
      Alert.alert('Empty Post', 'Please add some content or media to your post');
      return;
    }

    // Show post type selector
    setShowPostTypeSelector(true);
  };

  const handlePostTypeSelection = (type: 'feed' | 'channel') => {
    setPostType(type);
    publishPost(type);
  };

  const toggleLike = async (postId: string) => {
    await storeToggleLike(postId);
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'feed':
        return activeGroup ? activeGroup.name : 'Community Feed';
      case 'groups':
        return 'My Groups';
      case 'message':
        return 'Messages';
      default:
        return 'Community';
    }
  };

  const handlePostFilterSelect = (filter: 'all' | 'image' | 'video' | 'audio' | 'text') => {
    setSelectedPostFilter(filter);
    setShowPostTypeFilter(false);
  };

  const getFilteredPosts = () => {
    let filtered = posts;

    // Filter by Post Type
    if (selectedPostFilter !== 'all') {
      filtered = filtered.filter(post => {
        if (post.postType) return post.postType === selectedPostFilter;
        if (selectedPostFilter === 'image' && post.images && post.images.length > 0) return true;
        if (selectedPostFilter === 'video' && post.video) return true;
        if (selectedPostFilter === 'text' && !post.images && !post.video) return true;
        return false;
      });
    }

    // Filter by Tag
    if (selectedTag !== 'all') {
      filtered = filtered.filter(post => post.tags && post.tags.includes(selectedTag));
    }

    return filtered;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Custom Header with Menu Button */}
      <View style={styles.customHeader}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={toggleSidebar}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={28} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{getViewTitle()}</Text>
          </View>
          <View style={styles.headerRightButtons}>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={navigateToNotifications}
              activeOpacity={0.7}
            >
              <View style={styles.notificationIconContainer}>
                <Ionicons name="notifications-outline" size={24} color="#111827" />
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>3</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileButton}
              onPress={navigateToProfile}
              activeOpacity={0.7}
            >
              <View style={styles.profileIconContainer}>
                <Text style={styles.profileIconText}>{getUserInitial()}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Sidebar Overlay */}
      {showSidebar && (
        <TouchableOpacity
          style={styles.sidebarOverlay}
          activeOpacity={1}
          onPress={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: sidebarAnimation }],
          },
        ]}
      >
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Menu</Text>
          <TouchableOpacity onPress={() => setShowSidebar(false)}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.sidebarContent}>
          <TouchableOpacity
            style={[
              styles.sidebarItem,
              currentView === 'feed' && styles.sidebarItemActive,
            ]}
            onPress={() => handleViewChange('feed')}
          >
            <Ionicons
              name="home"
              size={24}
              color={currentView === 'feed' ? '#F1842D' : '#5C4A42'}
            />
            <Text
              style={[
                styles.sidebarItemText,
                currentView === 'feed' && styles.sidebarItemTextActive,
              ]}
            >
              Feed
            </Text>
          </TouchableOpacity>

          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarSectionTitle}>Sections</Text>

            <TouchableOpacity
              style={[
                styles.sidebarItem,
                currentView === 'groups' && styles.sidebarItemActive,
              ]}
              onPress={() => handleViewChange('groups')}
            >
              <Ionicons
                name="people"
                size={24}
                color={currentView === 'groups' ? '#F1842D' : '#5C4A42'}
              />
              <Text
                style={[
                  styles.sidebarItemText,
                  currentView === 'groups' && styles.sidebarItemTextActive,
                ]}
              >
                Groups
              </Text>
            </TouchableOpacity>

            {/* Render Actual Groups List in Sidebar if expanded or separate section */}
            {groups.length > 0 && (
              <View style={{ marginLeft: 20, marginTop: 8 }}>
                {groups.map(g => (
                  <TouchableOpacity
                    key={g._id}
                    style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => {
                      setActiveGroup(g);
                      setCurrentView('feed');
                      setShowSidebar(false);
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activeGroup?._id === g._id ? '#F1842D' : 'rgba(92, 74, 66, 0.12)', marginRight: 12 }} />
                    <Text style={{ fontSize: 14, color: activeGroup?._id === g._id ? '#2C2420' : '#5C4A42', fontWeight: activeGroup?._id === g._id ? '600' : '500' }} numberOfLines={1}>
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.sidebarItem,
                currentView === 'message' && styles.sidebarItemActive,
              ]}
              onPress={() => handleViewChange('message')}
            >
              <Ionicons
                name="chatbubbles"
                size={24}
                color={currentView === 'message' ? '#F1842D' : '#5C4A42'}
              />
              <Text
                style={[
                  styles.sidebarItemText,
                  currentView === 'message' && styles.sidebarItemTextActive,
                ]}
              >
                Messages
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <View style={{ flex: 1 }}>
        {currentView === 'feed' ? (
          <FlatList
            data={getFilteredPosts()}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshing={isStoreLoading}
            onRefresh={() => activeGroup && fetchGroupPosts(activeGroup._id)}
            ListHeaderComponent={
              <>
                {/* Assessment Banner - Show if not completed */}
                {!assessmentCompleted && (
                  <TouchableOpacity
                    style={styles.assessmentBanner}
                    onPress={() => setShowAssessment(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.bannerContent}>
                      <View style={styles.bannerIconContainer}>
                        <Ionicons name="clipboard-outline" size={24} color="#F1842D" />
                      </View>
                      <View style={styles.bannerTextContainer}>
                        <Text style={styles.bannerTitle}>Complete Your Assessment</Text>
                        <Text style={styles.bannerSubtitle}>Help us personalize your experience</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                )}

                {/* Filter Buttons */}
                <View style={styles.filterButtonsContainer}>
                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowPostTypeFilter(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.filterButtonText}>post-type</Text>
                    <Ionicons name="chevron-down" size={16} color="#111827" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => {
                      router.push('/(home)/membership-new');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.filterButtonText}>membership</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowTagFilter(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.filterButtonText}>tag</Text>
                    <Ionicons name="chevron-down" size={16} color="#111827" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>

                {/* Create Post Button */}
                <TouchableOpacity
                  style={styles.createPostButton}
                  onPress={() => setShowCreatePost(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.createPostContent}>
                    <Ionicons name="add-circle" size={24} color="#F1842D" />
                    <Text style={styles.createPostText}>
                      {activeGroup && activeGroup.name ? `Share in ${activeGroup.name}...` : 'Select a group to post...'}
                    </Text>
                  </View>
                  <View style={styles.mediaIcons}>
                    <Ionicons name="image-outline" size={20} color="#6B7280" style={{ marginRight: 12 }} />
                    <Ionicons name="videocam-outline" size={20} color="#6B7280" />
                  </View>
                </TouchableOpacity>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {activeGroup && activeGroup.name ? `${activeGroup.name} Posts` : 'Community Posts'}
                  </Text>
                </View>
              </>
            }
            ListEmptyComponent={
              !activeGroup && groups.length === 0 && !isStoreLoading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Join a course to access community groups.</Text>
                </View>
              ) : (
                <View style={[styles.emptyState, { paddingTop: 40 }]}>
                  <Text style={styles.emptyStateText}>No posts found</Text>
                </View>
              )
            }
            renderItem={({ item: post }) => (
              <View style={[styles.postCard, { marginHorizontal: 20 }]}>
                {/* Post Header */}
                <View style={styles.postHeader}>
                  <View style={styles.userInfo}>
                    <View style={styles.userAvatar}>
                      <Image
                        source={{ uri: post.author.photoURL || 'https://via.placeholder.com/40' }}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                      />
                    </View>
                    <View>
                      <Text style={styles.userName}>{post.author.displayName || 'User'}</Text>
                      <Text style={styles.postTime}>{/* format date */ new Date(post.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Post Content */}
                <Text style={styles.postContent}>{post.content}</Text>

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {post.tags.map(tag => (
                      <View key={tag} style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ fontSize: 12, color: '#6B7280' }}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Post Image/Video */}
                {post.images && post.images.length > 0 && (
                  <View style={styles.postMedia}>
                    <Image source={{ uri: post.images[0] }} style={{ width: '100%', height: 200, borderRadius: 8 }} resizeMode="cover" />
                  </View>
                )}

                {/* Post Actions */}
                <View style={styles.postActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => toggleLike(post._id)}
                  >
                    <Ionicons
                      name={post.userLiked ? "heart" : "heart-outline"}
                      size={22}
                      color={post.userLiked ? "#EF4444" : "#6B7280"}
                    />
                    <Text style={[styles.actionText, post.userLiked && styles.likedText]}>
                      {post.likeCount}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      setActivePostId(post._id);
                      setShowCommentsModal(true);
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={20} color="#6B7280" />
                    <Text style={styles.actionText}>{post.commentCount}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="share-social-outline" size={20} color="#6B7280" />
                    <Text style={styles.actionText}>0</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {currentView === 'groups' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Groups</Text>
                {groups.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyStateText}>No groups yet</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Join courses to be added to their community groups.
                    </Text>
                  </View>
                ) : (
                  groups.map(g => (
                    <TouchableOpacity
                      key={g._id}
                      style={styles.groupCard}
                      onPress={() => {
                        setActiveGroup(g);
                        setCurrentView('feed');
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}>
                        <View style={{ width: 50, height: 50, borderRadius: 12, backgroundColor: 'rgba(92, 74, 66, 0.08)', marginRight: 16 }} />
                        <View>
                          <Text style={{ fontSize: 17, fontWeight: '700', color: '#2C2420' }}>{g.name}</Text>
                          <Text style={{ fontSize: 14, color: '#5C4A42', fontWeight: '500' }}>{g.memberCount} members</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {currentView === 'message' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Messages</Text>
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={64} color="#9CA3AF" />
                  <Text style={styles.emptyStateText}>No messages yet</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Start a conversation with community members
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Create Post Modal */}
      <Modal
        visible={showCreatePost}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCreatePost(false);
          setShowPostTypeSelector(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Post</Text>
              <TouchableOpacity onPress={() => {
                setShowCreatePost(false);
                setShowPostTypeSelector(false);
              }}>
                <Ionicons name="close" size={28} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.postInput}
              placeholder="What's on your mind?"
              placeholderTextColor="#9CA3AF"
              multiline
              value={postContent}
              onChangeText={setPostContent}
              maxLength={500}
            />

            {selectedMedia && (
              <View style={styles.selectedMediaContainer}>
                <View style={styles.selectedMediaPreview}>
                  <Text style={styles.selectedMediaText}>
                    {mediaType === 'image' ? '📷 Image selected' : '🎥 Video selected'}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    setSelectedMedia(null);
                    setMediaType(null);
                  }}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#5C4A42', marginBottom: 8 }}>Tags</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['meditation', 'spiritual', 'wellness', 'learning', 'community'].map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: createPostTags.includes(tag) ? '#F1842D' : '#F3F4F6',
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: createPostTags.includes(tag) ? '#F1842D' : '#E5E7EB'
                    }}
                    onPress={() => {
                      if (createPostTags.includes(tag)) {
                        setCreatePostTags(prev => prev.filter(t => t !== tag));
                      } else {
                        setCreatePostTags(prev => [...prev, tag]);
                      }
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      color: createPostTags.includes(tag) ? '#FFF' : '#4B5563',
                      fontWeight: '500'
                    }}>
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.mediaButtons}>
              <TouchableOpacity
                style={styles.mediaButton}
                onPress={handlePickImage}
              >
                <Ionicons name="image-outline" size={24} color="#F1842D" />
                <Text style={styles.mediaButtonText}>Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mediaButton}
                onPress={handlePickVideo}
              >
                <Ionicons name="videocam-outline" size={24} color="#F1842D" />
                <Text style={styles.mediaButtonText}>Video</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.publishButton,
                (!postContent.trim() && !selectedMedia) && styles.publishButtonDisabled
              ]}
              onPress={handleCreatePost}
              disabled={!postContent.trim() && !selectedMedia}
            >
              <Text style={styles.publishButtonText}>Publish Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Post Type Filter Bottom Sheet */}
      <Modal
        visible={showPostTypeFilter}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPostTypeFilter(false)}
      >
        <View style={styles.filterModalOverlay}>
          <TouchableOpacity
            style={styles.filterModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowPostTypeFilter(false)}
          />
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter by Post Type</Text>
              <TouchableOpacity onPress={() => setShowPostTypeFilter(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptionsContainer}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedPostFilter === 'all' && styles.filterOptionActive
                ]}
                onPress={() => handlePostFilterSelect('all')}
              >
                <Ionicons
                  name="grid-outline"
                  size={24}
                  color={selectedPostFilter === 'all' ? '#F1842D' : '#5C4A42'}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedPostFilter === 'all' && styles.filterOptionTextActive
                  ]}
                >
                  All Posts
                </Text>
                {selectedPostFilter === 'all' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F1842D" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedPostFilter === 'image' && styles.filterOptionActive
                ]}
                onPress={() => handlePostFilterSelect('image')}
              >
                <Ionicons
                  name="image-outline"
                  size={24}
                  color={selectedPostFilter === 'image' ? '#F1842D' : '#5C4A42'}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedPostFilter === 'image' && styles.filterOptionTextActive
                  ]}
                >
                  Image
                </Text>
                {selectedPostFilter === 'image' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F1842D" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedPostFilter === 'video' && styles.filterOptionActive
                ]}
                onPress={() => handlePostFilterSelect('video')}
              >
                <Ionicons
                  name="videocam-outline"
                  size={24}
                  color={selectedPostFilter === 'video' ? '#F1842D' : '#5C4A42'}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedPostFilter === 'video' && styles.filterOptionTextActive
                  ]}
                >
                  Video
                </Text>
                {selectedPostFilter === 'video' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F1842D" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedPostFilter === 'audio' && styles.filterOptionActive
                ]}
                onPress={() => handlePostFilterSelect('audio')}
              >
                <Ionicons
                  name="musical-notes-outline"
                  size={24}
                  color={selectedPostFilter === 'audio' ? '#F1842D' : '#5C4A42'}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedPostFilter === 'audio' && styles.filterOptionTextActive
                  ]}
                >
                  Audio
                </Text>
                {selectedPostFilter === 'audio' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F1842D" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedPostFilter === 'text' && styles.filterOptionActive
                ]}
                onPress={() => handlePostFilterSelect('text')}
              >
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={selectedPostFilter === 'text' ? '#F1842D' : '#5C4A42'}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedPostFilter === 'text' && styles.filterOptionTextActive
                  ]}
                >
                  Text
                </Text>
                {selectedPostFilter === 'text' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F1842D" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tag Filter Bottom Sheet */}
      <Modal
        visible={showTagFilter}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTagFilter(false)}
      >
        <View style={styles.filterModalOverlay}>
          <TouchableOpacity
            style={styles.filterModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowTagFilter(false)}
          />
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter by Tag</Text>
              <TouchableOpacity onPress={() => setShowTagFilter(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptionsContainer}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedTag === 'all' && styles.filterOptionActive
                ]}
                onPress={() => {
                  setSelectedTag('all');
                  setShowTagFilter(false);
                }}
              >
                <Ionicons
                  name="pricetags-outline"
                  size={24}
                  color={selectedTag === 'all' ? '#F1842D' : '#5C4A42'}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedTag === 'all' && styles.filterOptionTextActive
                  ]}
                >
                  All Tags
                </Text>
                {selectedTag === 'all' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F1842D" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedTag === 'meditation' && styles.filterOptionActive
                ]}
                onPress={() => {
                  setSelectedTag('meditation');
                  setShowTagFilter(false);
                }}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={24}
                  color={selectedTag === 'meditation' ? '#F1842D' : '#5C4A42'}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedTag === 'meditation' && styles.filterOptionTextActive
                  ]}
                >
                  Meditation
                </Text>
                {selectedTag === 'meditation' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F1842D" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedTag === 'spiritual' && styles.filterOptionActive
                ]}
                onPress={() => {
                  setSelectedTag('spiritual');
                  setShowTagFilter(false);
                }}
              >
                <Ionicons
                  name="flower-outline"
                  size={24}
                  color={selectedTag === 'spiritual' ? '#F1842D' : '#5C4A42'}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedTag === 'spiritual' && styles.filterOptionTextActive
                  ]}
                >
                  Spiritual
                </Text>
                {selectedTag === 'spiritual' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F1842D" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedTag === 'wellness' && styles.filterOptionActive
                ]}
                onPress={() => {
                  setSelectedTag('wellness');
                  setShowTagFilter(false);
                }}
              >
                <Ionicons
                  name="fitness-outline"
                  size={24}
                  color={selectedTag === 'wellness' ? '#F1842D' : '#5C4A42'}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedTag === 'wellness' && styles.filterOptionTextActive
                  ]}
                >
                  Wellness
                </Text>
                {selectedTag === 'wellness' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F1842D" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedTag === 'learning' && styles.filterOptionActive
                ]}
                onPress={() => {
                  setSelectedTag('learning');
                  setShowTagFilter(false);
                }}
              >
                <Ionicons
                  name="book-outline"
                  size={24}
                  color={selectedTag === 'learning' ? '#F1842D' : '#5C4A42'}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedTag === 'learning' && styles.filterOptionTextActive
                  ]}
                >
                  Learning
                </Text>
                {selectedTag === 'learning' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F1842D" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedTag === 'community' && styles.filterOptionActive
                ]}
                onPress={() => {
                  setSelectedTag('community');
                  setShowTagFilter(false);
                }}
              >
                <Ionicons
                  name="people-outline"
                  size={24}
                  color={selectedTag === 'community' ? '#F1842D' : '#5C4A42'}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedTag === 'community' && styles.filterOptionTextActive
                  ]}
                >
                  Community
                </Text>
                {selectedTag === 'community' && (
                  <Ionicons name="checkmark-circle" size={20} color="#F1842D" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Post Type Selector Modal */}
      <Modal
        visible={showPostTypeSelector}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPostTypeSelector(false)}
      >
        <View style={styles.postTypeModalOverlay}>
          <View style={styles.postTypeModalContent}>
            <Text style={styles.postTypeModalTitle}>Where would you like to post?</Text>

            <TouchableOpacity
              style={styles.postTypeOption}
              onPress={() => handlePostTypeSelection('feed')}
            >
              <View style={styles.postTypeOptionIcon}>
                <Ionicons name="home" size={24} color="#F1842D" />
              </View>
              <View style={styles.postTypeOptionContent}>
                <Text style={styles.postTypeOptionTitle}>Post on Feed</Text>
                <Text style={styles.postTypeOptionDescription}>
                  Share with the entire community
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.postTypeOption}
              onPress={() => handlePostTypeSelection('channel')}
            >
              <View style={styles.postTypeOptionIcon}>
                <Ionicons name="chatbubbles" size={24} color="#F1842D" />
              </View>
              <View style={styles.postTypeOptionContent}>
                <Text style={styles.postTypeOptionTitle}>Post in Channel</Text>
                <Text style={styles.postTypeOptionDescription}>
                  Share in a specific group channel
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.postTypeCancelButton}
              onPress={() => setShowPostTypeSelector(false)}
            >
              <Text style={styles.postTypeCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Assessment Modal */}
      <AssessmentModal
        visible={showAssessment}
        onClose={() => setShowAssessment(false)}
        onComplete={handleAssessmentComplete}
      />

      <CommentsModal
        visible={showCommentsModal}
        postId={activePostId}
        onClose={() => setShowCommentsModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF8F3',
  },
  customHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(92, 74, 66, 0.06)',
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    shadowColor: '#5C4A42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2420',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#5C4A42',
    marginTop: 2,
    fontWeight: '500',
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    padding: 4,
  },
  notificationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 254, 249, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F1842D',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileButton: {
    padding: 4,
  },
  profileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(253, 186, 116, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F1842D',
    shadowColor: '#F1842D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  profileIconText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F1842D',
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(44, 36, 32, 0.5)',
    zIndex: 998,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: '#FFFFFF',
    zIndex: 999,
    shadowColor: '#2C2420',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(92, 74, 66, 0.06)',
  },
  sidebarTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2C2420',
    letterSpacing: 0.5,
  },
  sidebarContent: {
    paddingTop: 20,
  },
  sidebarSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sidebarSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8C7B73',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(241, 132, 45, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#F1842D',
  },
  sidebarItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#5C4A42',
  },
  sidebarItemTextActive: {
    color: '#F1842D',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2420',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  emptyStateSubtext: {
    fontSize: 15,
    color: '#5C4A42',
    textAlign: 'center',
    lineHeight: 22,
  },
  postTypeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(44, 36, 32, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  postTypeModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#2C2420',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  postTypeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2420',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  postTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 254, 249, 0.8)',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(92, 74, 66, 0.08)',
  },
  postTypeOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(241, 132, 45, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  postTypeOptionContent: {
    flex: 1,
  },
  postTypeOptionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2C2420',
    marginBottom: 4,
  },
  postTypeOptionDescription: {
    fontSize: 14,
    color: '#5C4A42',
    fontWeight: '500',
  },
  postTypeCancelButton: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  postTypeCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  assessmentBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  bannerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#60A5FA',
  },
  createPostButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(92, 74, 66, 0.08)',
    shadowColor: '#5C4A42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  createPostContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  createPostText: {
    flex: 1,
    fontSize: 15,
    color: '#5C4A42',
    marginLeft: 12,
    fontWeight: '500',
  },
  mediaIcons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(92, 74, 66, 0.06)',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2C2420',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(92, 74, 66, 0.08)',
    shadowColor: '#5C4A42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 254, 249, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2420',
  },
  postTime: {
    fontSize: 13,
    color: '#8C7B73',
    marginTop: 2,
    fontWeight: '500',
  },
  postContent: {
    fontSize: 15,
    color: '#5C4A42',
    lineHeight: 22,
    marginBottom: 16,
    fontWeight: '500',
  },
  postMedia: {
    backgroundColor: 'rgba(255, 254, 249, 0.8)',
    borderRadius: 16,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(92, 74, 66, 0.08)',
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 18,
    shadowColor: '#5C4A42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(92, 74, 66, 0.08)',
  },
  mediaPlaceholder: {
    fontSize: 48,
    marginBottom: 8,
  },
  mediaLabel: {
    fontSize: 14,
    color: '#5C4A42',
    fontWeight: '500',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(92, 74, 66, 0.06)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#8C7B73',
    fontWeight: '600',
  },
  likedText: {
    color: '#EC4899',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(44, 36, 32, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
    shadowColor: '#2C2420',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2420',
    letterSpacing: 0.3,
  },
  postInput: {
    borderWidth: 1,
    borderColor: 'rgba(92, 74, 66, 0.12)',
    borderRadius: 16,
    padding: 18,
    fontSize: 15,
    color: '#2C2420',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 254, 249, 0.5)',
  },
  selectedMediaContainer: {
    marginBottom: 16,
  },
  selectedMediaPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(241, 132, 45, 0.1)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(241, 132, 45, 0.2)',
  },
  selectedMediaText: {
    fontSize: 14,
    color: '#F1842D',
    fontWeight: '600',
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(241, 132, 45, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(241, 132, 45, 0.2)',
  },
  mediaButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F1842D',
  },
  publishButton: {
    backgroundColor: '#F1842D',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#F1842D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  publishButtonDisabled: {
    backgroundColor: '#8C7B73',
    shadowOpacity: 0,
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(92, 74, 66, 0.08)',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2420',
  },
  filterModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(44, 36, 32, 0.5)',
  },
  filterModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '60%',
    shadowColor: '#2C2420',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2420',
    letterSpacing: 0.3,
  },
  filterOptionsContainer: {
    gap: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 254, 249, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(92, 74, 66, 0.08)',
    gap: 12,
  },
  filterOptionActive: {
    backgroundColor: 'rgba(241, 132, 45, 0.1)',
    borderColor: '#F1842D',
  },
  filterOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#5C4A42',
  },
  filterOptionTextActive: {
    color: '#F1842D',
    fontWeight: '600',
  },
});
