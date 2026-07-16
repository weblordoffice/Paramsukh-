import { useRouter } from 'expo-router';
import React, { useRef, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Linking, Animated, StyleSheet, Image, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import Header from '../../components/Header';
import { useBottomTabBarHeight } from '../../hooks/useBottomTabBarHeight';
import { useBlogStore } from '../../store/blogStore';
import { useRecommendationStore } from '../../store/recommendationStore';
import apiClient from '../../utils/apiClient';

// Helper functions for video URL parsing
const isDirectVideoUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const u = url.toLowerCase();
  return (
    u.includes('cloudinary.com') ||
    u.startsWith('file://') ||
    u.includes('.mp4') ||
    u.includes('.m3u8') ||
    u.includes('.webm') ||
    u.includes('video/upload')
  );
};

const getYouTubeId = (url: string): string | null => {
  if (!url || typeof url !== 'string') return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

type NativeVideoPlayerProps = {
  videoUrl: string;
};

const NativeVideoPlayer = ({ videoUrl }: NativeVideoPlayerProps) => {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <View style={styles.videoPlayerWrapper}>
      <VideoView
        player={player}
        style={styles.nativePlayer}
        allowsFullscreen
        allowsPictureInPicture
      />
    </View>
  );
};

type MinimalVideoPlayerProps = {
  videoUrl: string;
};

const MinimalVideoPlayer = ({ videoUrl }: MinimalVideoPlayerProps) => {
  const ytId = getYouTubeId(videoUrl);
  const isYouTube = !!ytId;
  const isDirect = !isYouTube && isDirectVideoUrl(videoUrl);

  if (isYouTube) {
    return (
      <View style={styles.videoPlayerWrapper}>
        <WebView
          style={styles.webViewPlayer}
          source={{ uri: `https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1` }}
          allowsFullscreenVideo
          javaScriptEnabled
          scrollEnabled={false}
        />
      </View>
    );
  }

  if (isDirect) {
    return <NativeVideoPlayer videoUrl={videoUrl} />;
  }

  return (
    <View style={styles.fallbackPlayerContainer}>
      <Text style={styles.fallbackPlayerText}>Opening link in web browser...</Text>
      <TouchableOpacity
        style={styles.fallbackLinkBtn}
        onPress={() => Linking.openURL(videoUrl)}
      >
        <Text style={styles.fallbackLinkText}>Open Video</Text>
      </TouchableOpacity>
    </View>
  );
};

const CATEGORY_CONFIG: Record<
  string,
  { color: string; bg: string; icon: string; label: string }
> = {
  physical: { color: '#FFFFFF', bg: '#EF4444', icon: 'barbell', label: 'Physical' },
  mental: { color: '#FFFFFF', bg: '#8B5CF6', icon: 'brain', label: 'Mental' },
  financial: { color: '#1A1A1A', bg: '#22C55E', icon: 'cash', label: 'Financial' },
  relationship: { color: '#FFFFFF', bg: '#EC4899', icon: 'heart', label: 'Relationship' },
  spiritual: { color: '#FFFFFF', bg: '#F59E0B', icon: 'sparkles', label: 'Spiritual' },
  general: { color: '#FFFFFF', bg: '#64748B', icon: 'layers', label: 'General' },
};

function getCategoryConfig(category?: string) {
  if (!category) return null;
  const key = category.toLowerCase().trim();
  return CATEGORY_CONFIG[key] || { color: '#FFFFFF', bg: '#4F46E5', icon: 'layers', label: category };
}

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  onPress?: () => void;
}

interface QuickAccessItemProps {
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  title: string;
  description: string;
  iconBg: string;
  iconColor?: string;
  onPress: () => void;
}

function FeatureCard({ icon, title, description, color, bgColor, onPress }: FeatureCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.8}
      style={[styles.featureCard, { transform: [{ scale: scaleAnim }] }]}
    >
      <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </TouchableOpacity>
  );
}

function QuickAccessItem({ icon, emoji, title, description, iconBg, iconColor, onPress }: QuickAccessItemProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.7}
      style={[styles.quickAccessItem, { transform: [{ scale: scaleAnim }] }]}
    >
      <View style={[styles.quickAccessIcon, { backgroundColor: iconBg }]}>
        {icon ? (
          <Ionicons name={icon} size={22} color={iconColor || '#F1842D'} />
        ) : (
          <Text style={styles.quickAccessEmoji}>{emoji}</Text>
        )}
      </View>
      <View style={styles.quickAccessContent}>
        <Text style={styles.quickAccessTitle}>{title}</Text>
        <Text style={styles.quickAccessDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#8C7B73" />
    </TouchableOpacity>
  );
}

export default function HomeTab() {
  const router = useRouter();
  const { blogs, fetchBlogs } = useBlogStore();
  const { recommendations, loading: loadingRecs, fetchRecommendations } = useRecommendationStore();

  const scrollY = useRef(new Animated.Value(0)).current;
  const bottomTabHeight = useBottomTabBarHeight();
  const heroScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });

  const [introVideoUrl, setIntroVideoUrl] = useState<string>('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [isVideoModalVisible, setIsVideoModalVisible] = useState(false);

  useEffect(() => {
    const loadAndSyncVideo = async () => {
      try {
        // 1. Read cached URL first to enable instant playback
        const cached = await AsyncStorage.getItem('welcome_video_url');
        if (cached) {
          setIntroVideoUrl(cached);
        }
        
        // 2. Fetch the latest from the backend to sync the cache
        const response = await apiClient.get('/config/welcome-video');
        if (response.data?.success && response.data?.videoUrl) {
          const latestUrl = response.data.videoUrl;
          setIntroVideoUrl(latestUrl);
          await AsyncStorage.setItem('welcome_video_url', latestUrl);
        }
      } catch (err) {
        console.log('Failed welcome video sync:', err);
      }
    };
    loadAndSyncVideo();
  }, []);

  const handleWatchIntro = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsVideoModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <Header />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomTabHeight }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* Hero Section - Premium Gradient */}
        <Animated.View style={[styles.heroSection, { transform: [{ scale: heroScale }] }]}>
          <View style={styles.heroGradient} />
          <View style={styles.heroContent}>
            <View style={styles.heroHeader}>
              <View style={styles.heroIconContainer}>
                <Ionicons name="sparkles" size={32} color="#FFFFFF" />
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroGreeting}>Welcome to</Text>
                <Text style={styles.heroTitle}>ParamSukh Gurukul</Text>
              </View>
            </View>

            <Text style={styles.heroDescription}>
              Your spiritual companion for meditation, learning & community
            </Text>

            <TouchableOpacity
              style={styles.heroButton}
              onPress={handleWatchIntro}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={16} color="#F1842D" style={{ marginRight: 6 }} />
              <Text style={styles.heroButtonText}>Watch Intro Video</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Feature Cards - Warm Neumorphic */}
        <View style={styles.featureSection}>
          <Text style={styles.sectionTitle}>What We Offer</Text>
          <View style={styles.featureGrid}>
            <FeatureCard
              icon="book"
              title="Courses"
              description="Learn at your own pace"
              color="#8B5CF6"
              bgColor="rgba(139, 92, 246, 0.12)"
              onPress={() => router.push('/(home)/courses')}
            />
            <FeatureCard
              icon="people"
              title="Community"
              description="Connect with others"
              color="#2DD4BF"
              bgColor="rgba(45, 212, 191, 0.12)"
              onPress={() => router.push('/(home)/community')}
            />
            <FeatureCard
              icon="calendar"
              title="Events"
              description="Join live sessions"
              color="#F1842D"
              bgColor="rgba(241, 132, 45, 0.15)"
              onPress={() => router.push('/(home)/events')}
            />
            <FeatureCard
              icon="headset"
              title="Podcasts"
              description="Audio wisdom"
              color="#FB7185"
              bgColor="rgba(251, 113, 133, 0.12)"
              onPress={() => router.push('/(home)/podcasts')}
            />
          </View>
        </View>

        {/* Recommendations Section - AI-powered Carousel */}
        {!loadingRecs && recommendations.length > 0 && (
          <View style={styles.recommendationSection}>
            <Text style={styles.sectionTitle}>Personalized for You</Text>
            <Text style={styles.sectionSubtitle}>AI recommendations based on your wellness assessment</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendationScrollContent}
            >
              {recommendations.map((course) => {
                const categoryConfig = getCategoryConfig(course.category);
                return (
                  <TouchableOpacity
                    key={course._id}
                    style={styles.recCard}
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({
                        pathname: '/course-detail',
                        params: {
                          id: course._id,
                          title: course.title,
                          color: course.color,
                          duration: course.duration,
                          videos: course.totalVideos || 0,
                        },
                      });
                    }}
                  >
                    <View style={styles.recImageContainer}>
                      {course.thumbnailUrl ? (
                        <Image source={{ uri: course.thumbnailUrl }} style={styles.recImage} />
                      ) : (
                        <View style={[styles.recPlaceholderImage, { backgroundColor: course.color || '#F1842D' }]}>
                          <Ionicons name="book" size={32} color="#FFFFFF" />
                        </View>
                      )}
                      
                      {categoryConfig && (
                        <View style={[styles.recCategoryBadge, { backgroundColor: categoryConfig.bg }]}>
                          <Ionicons name={categoryConfig.icon as any} size={10} color={categoryConfig.color} />
                          <Text style={[styles.recCategoryText, { color: categoryConfig.color }]}>
                            {categoryConfig.label}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.recCardContent}>
                      <Text style={styles.recCourseTitle} numberOfLines={1}>
                        {course.title}
                      </Text>
                      
                      {/* AI explanation highlight card */}
                      <View style={styles.aiExplanationCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <Ionicons name="sparkles" size={12} color="#F1842D" />
                          <Text style={styles.aiExplanationLabel}>AI GUIDANCE</Text>
                        </View>
                        <Text style={styles.aiExplanationText} numberOfLines={3}>
                          {course.whyThisFits || 'This course matches your assessment goals.'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Blogs Section - Premium Horizontal Cards */}
        {blogs && blogs.length > 0 && (
          <View style={styles.blogSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Latest Blogs</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/blogs');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.blogScrollContent}
            >
              {blogs.map((blog) => (
                <TouchableOpacity
                  key={blog._id}
                  style={styles.blogCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({
                      pathname: '/blog-detail',
                      params: { id: blog._id }
                    });
                  }}
                >
                  <View style={styles.blogImageContainer}>
                    {blog.imageUrl ? (
                      <Image source={{ uri: blog.imageUrl }} style={styles.blogImage} />
                    ) : (
                      <View style={styles.blogPlaceholderImage}>
                        <Ionicons name="document-text" size={32} color="#8C7B73" />
                      </View>
                    )}
                  </View>
                  <View style={styles.blogCardContent}>
                    <Text style={styles.blogTitle} numberOfLines={2}>
                      {blog.title}
                    </Text>
                    <Text style={styles.blogAuthor} numberOfLines={1}>
                      By {blog.author}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quick Access - Warm Elevated List */}
        <View style={styles.quickAccessSection}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickAccessList}>
            <QuickAccessItem
              icon="people"
              title="Counseling"
              description="Book 1-on-1 guidance sessions"
              iconBg="rgba(139, 92, 246, 0.12)"
              iconColor="#8B5CF6"
              onPress={() => router.push('/counseling')}
            />
            <View style={styles.divider} />
            <QuickAccessItem
              emoji="🛍️"
              title="Shops"
              description="Pooja items, idols, books & frames"
              iconBg="rgba(92, 74, 66, 0.08)"
              onPress={() => router.push('/shops')}
            />
            <View style={styles.divider} />
            <QuickAccessItem
              emoji="💝"
              title="Donations"
              description="Support ParamSukh initiatives"
              iconBg="rgba(92, 74, 66, 0.08)"
              onPress={() => router.push('/donations')}
            />
            <View style={styles.divider} />
            <QuickAccessItem
              emoji="🎙️"
              title="Podcasts"
              description="Audio talks and meditations"
              iconBg="rgba(92, 74, 66, 0.08)"
              onPress={() => router.push('/(home)/podcasts')}
            />

          </View>
        </View>
      </ScrollView>

      {/* Premium Minimalist Video Modal */}
      <Modal
        visible={isVideoModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsVideoModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlayDismiss}
            activeOpacity={1}
            onPress={() => setIsVideoModalVisible(false)}
          />
          
          <View style={styles.modalContent}>
            {/* Header / Dismiss Button */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>Welcome to ParamSukh</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setIsVideoModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Video Player */}
            <View style={styles.playerContainer}>
              {isVideoModalVisible && introVideoUrl ? (
                <MinimalVideoPlayer videoUrl={introVideoUrl} />
              ) : (
                <ActivityIndicator size="large" color="#F1842D" />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF8F3',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // paddingBottom is now handled dynamically via useBottomTabBarHeight hook
  },
  // Hero Section - Premium Gradient
  heroSection: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#F1842D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2C2420',
    opacity: 0.92,
  },
  heroContent: {
    padding: 28,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  heroIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(241, 132, 45, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(241, 132, 45, 0.4)',
  },
  heroTextContainer: {
    flex: 1,
  },
  heroGreeting: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 3,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 22,
    marginBottom: 22,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  heroButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1842D',
  },
  // Feature Section
  featureSection: {
    marginHorizontal: 20,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C2420',
    marginBottom: 18,
    letterSpacing: 0.3,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#5C4A42',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2420',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C4A42',
    textAlign: 'center',
    lineHeight: 19,
  },
  // Quick Access Section
  quickAccessSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  quickAccessList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#5C4A42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  quickAccessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  quickAccessIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  quickAccessEmoji: {
    fontSize: 22,
  },
  quickAccessContent: {
    flex: 1,
  },
  quickAccessTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2420',
    marginBottom: 3,
  },
  quickAccessDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C4A42',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(244, 243, 235, 0.9)',
    marginHorizontal: 20,
  },
  blogSection: {
    marginBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 14,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1842D',
  },
  blogScrollContent: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  blogCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#5C4A42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  blogImageContainer: {
    height: 120,
    width: '100%',
    backgroundColor: '#F4F3EB',
  },
  blogImage: {
    height: '100%',
    width: '100%',
    resizeMode: 'cover',
  },
  blogPlaceholderImage: {
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blogCardContent: {
    padding: 12,
  },
  blogTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C2420',
    marginBottom: 4,
    height: 38,
  },
  blogAuthor: {
    fontSize: 11,
    color: '#8C7B73',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalOverlayDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#1E1613',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerWrapper: {
    width: '100%',
    height: '100%',
  },
  webViewPlayer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  nativePlayer: {
    flex: 1,
  },
  fallbackPlayerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fallbackPlayerText: {
    color: '#8C7B73',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  fallbackLinkBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F1842D',
  },
  fallbackLinkText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  recommendationSection: {
    marginVertical: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#8C7B73',
    marginHorizontal: 20,
    marginTop: -8,
    marginBottom: 16,
  },
  recommendationScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  recCard: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#5C4A42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F4F3EB',
  },
  recImageContainer: {
    height: 140,
    position: 'relative',
  },
  recImage: {
    width: '100%',
    height: '100%',
  },
  recPlaceholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recCategoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  recCategoryText: {
    fontSize: 10,
    fontWeight: '700',
  },
  recCardContent: {
    padding: 16,
  },
  recCourseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2420',
    marginBottom: 10,
  },
  aiExplanationCard: {
    backgroundColor: '#FDF8F3',
    borderWidth: 1,
    borderColor: '#F1842D30',
    borderRadius: 12,
    padding: 10,
  },
  aiExplanationLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F1842D',
    letterSpacing: 0.5,
  },
  aiExplanationText: {
    fontSize: 12,
    color: '#5C4A42',
    lineHeight: 16,
  },
});
