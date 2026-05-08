import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Dimensions,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');

const YOUTUBE_WEBVIEW_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const YOUTUBE_ERROR_CHECK_SCRIPT = `
  (function () {
    if (window.__ytErrorProbeInstalled) return;
    window.__ytErrorProbeInstalled = true;

    function postError(code) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'YOUTUBE_ERROR', code: code }));
      } catch (e) {}
    }

    function check() {
      try {
        var text = ((document && document.body && document.body.innerText) || '').toLowerCase();
        if (text.includes('error 153') || text.includes('video player configuration error')) {
          postError('153');
          return;
        }
        if (text.includes('error 152') || text.includes('152-4')) {
          postError('152');
          return;
        }
        if (text.includes('error 150')) {
          postError('150');
          return;
        }
        if (text.includes('video unavailable') || text.includes('watch on youtube')) {
          postError('video_unavailable');
        }
      } catch (e) {}
    }

    setTimeout(check, 1000);
    setTimeout(check, 2500);
    setTimeout(check, 5000);
  })();
  true;
`;

const extractYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');

    if (host === 'youtu.be') {
      return parsed.pathname.replace('/', '').trim() || null;
    }

    if (host.includes('youtube.com')) {
      const fromQuery = parsed.searchParams.get('v');
      if (fromQuery) return fromQuery;

      const parts = parsed.pathname.split('/').filter(Boolean);
      const embedIndex = parts.findIndex((part) => part === 'embed' || part === 'shorts');
      if (embedIndex >= 0 && parts[embedIndex + 1]) {
        return parts[embedIndex + 1];
      }
    }
  } catch {
    // Ignore parse failures and fallback to regex.
  }

  const fallback = url.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  return fallback?.[1] || null;
};

interface Podcast {
  _id: string;
  title: string;
  host: string;
  duration: string;
  category: string;
  description: string;
  thumbnailUrl: string;
  source: 'youtube' | 'local';
  videoUrl?: string;
  youtubeUrl?: string;
  accessType: 'free' | 'membership' | 'paid';
  requiredMemberships?: string[];
  price?: number;
  currencyCode?: string;
  isPlaying?: boolean;
  canAccess?: boolean;
  accessReason?: string;
}

export default function PodcastsScreen() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Video Player State
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null);
  const [youtubeMode, setYoutubeMode] = useState<'embed' | 'watch'>('embed');
  const [youtubePlaybackBlocked, setYoutubePlaybackBlocked] = useState(false);

  const videoRef = useRef<Video>(null);

  const categories = ['All', 'Meditation', 'Discourse', 'Scripture', 'Mindfulness', 'Mantra', 'Other'];

  const fetchPodcasts = useCallback(async () => {
    try {
      let response;
      if (user && token) {
        // Authenticated user - get accessible podcasts (free + membership + purchased)
        response = await axios.get(`${API_URL}/podcasts/user/accessible`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Unauthenticated - get only free podcasts
        response = await axios.get(`${API_URL}/podcasts`);
      }

      if (response.data && response.data.success) {
        setPodcasts(response.data.data.podcasts.map((p: any) => ({ 
          ...p, 
          isPlaying: false,
          canAccess: typeof p.canAccess === 'boolean' ? p.canAccess : p.accessType === 'free'
        })) || []);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Unauthenticated
        Alert.alert('Login Required', 'Please login to view all podcasts');
      } else if (error.response?.status === 404) {
        setPodcasts([]);
      } else {
        Alert.alert('Error', 'Failed to load podcasts');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, token]);

  useEffect(() => {
    fetchPodcasts();
  }, [fetchPodcasts]);

  useEffect(() => {
    if (!currentPodcast) return;
    setYoutubeMode('embed');
    setYoutubePlaybackBlocked(false);
  }, [currentPodcast?._id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPodcasts();
  }, [fetchPodcasts]);

  const handlePlayPodcast = async (podcast: Podcast) => {
    if (!user && podcast.accessType !== 'free') {
      Alert.alert(
        'Login Required',
        'Please login to access this content',
        [
          { text: 'Login', onPress: () => router.push('/signin') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    if (podcast.accessType === 'free') {
      setCurrentPodcast(podcast);
      return;
    }

    if (podcast.canAccess === false && podcast.accessType === 'membership') {
      Alert.alert(
        'Premium Content',
        'This podcast is available for premium members. Upgrade your membership to access.',
        [
          { text: 'View Plans', onPress: () => router.push('/membership-new') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    if (podcast.canAccess === false && podcast.accessType === 'paid') {
      setSelectedPodcast(podcast);
      setShowPaymentFlow(true);
      return;
    }

    if (!token) {
      Alert.alert('Login Required', 'Please login to continue');
      return;
    }

    try {
      // Stream endpoint returns gated podcast payload with media URLs when access is allowed
      const streamResponse = await axios.get(`${API_URL}/podcasts/${podcast._id}/stream`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (streamResponse.data?.success && streamResponse.data?.data?.podcast) {
        setCurrentPodcast(streamResponse.data.data.podcast);
      } else {
        Alert.alert('Error', 'Unable to open podcast stream');
      }
    } catch (error: any) {
      Alert.alert('Access Denied', error.response?.data?.reason || 'You do not have access to this podcast');
    }
  };

  const handlePurchasePodcast = async (podcast: Podcast) => {
    if (!user || !token) {
      Alert.alert('Login Required', 'Please login to purchase podcasts');
      return;
    }

    setProcessingPayment(true);
    try {
      // Create payment link
      const paymentResponse = await axios.post(
        `${API_URL}/podcasts/${podcast._id}/create-payment`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (paymentResponse.data?.success && paymentResponse.data?.data?.url) {
        const paymentLinkId = paymentResponse.data?.data?.paymentLinkId;

        // Open payment URL
        await Linking.openURL(paymentResponse.data.data.url);

        // Let user confirm payment from app after checkout completion
        Alert.alert(
          'Complete Payment',
          'After finishing payment, tap "I Completed Payment" to unlock access.',
          [
            {
              text: 'I Completed Payment',
              onPress: async () => {
                try {
                  const confirmResponse = await axios.post(
                    `${API_URL}/podcasts/${podcast._id}/confirm-payment`,
                    { paymentLinkId },
                    { headers: { Authorization: `Bearer ${token}` } }
                  );

                  if (confirmResponse.data?.success) {
                    setShowPaymentFlow(false);
                    await fetchPodcasts();
                    Alert.alert('Success', 'Podcast unlocked successfully');
                  } else {
                    Alert.alert('Pending', 'Payment is not completed yet. Please try again in a moment.');
                  }
                } catch (confirmError: any) {
                  Alert.alert('Error', confirmError.response?.data?.message || 'Unable to confirm payment right now');
                }
              }
            },
            { text: 'Close', onPress: () => setShowPaymentFlow(false), style: 'cancel' }
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to initiate payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const closePlayer = () => {
    setCurrentPodcast(null);
    setYoutubeMode('embed');
    setYoutubePlaybackBlocked(false);
  };

  const handleYouTubeMessage = (event: any) => {
    try {
      const raw = event?.nativeEvent?.data;
      if (!raw) return;
      const parsed = JSON.parse(raw);

      if (parsed?.type === 'YOUTUBE_ERROR') {
        const code = String(parsed?.code || '').toLowerCase();
        const isBlockedCode =
          code.includes('153') ||
          code.includes('152') ||
          code.includes('150') ||
          code.includes('video_unavailable');

        if (!isBlockedCode) return;

        if (youtubeMode === 'embed') {
          setYoutubeMode('watch');
          return;
        }

        setYoutubePlaybackBlocked(true);
      }
    } catch {
      // Ignore non-JSON postMessage payloads.
    }
  };

  const openPodcastOnYouTube = async (url?: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open YouTube link');
    }
  };

  const filteredPodcasts = selectedCategory === 'All'
    ? podcasts
    : podcasts.filter((p) => p.category === selectedCategory);

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Podcasts</Text>
        <TouchableOpacity className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center" onPress={fetchPodcasts}>
          <Ionicons name="refresh" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <View className="bg-white border-b border-gray-200 py-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5 gap-2">
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              className={`px-4 py-2 rounded-[20px] border ${selectedCategory === category
                ? 'bg-blue-500 border-blue-500'
                : 'bg-gray-100 border-gray-200'
                }`}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                className={`text-sm font-semibold ${selectedCategory === category ? 'text-white' : 'text-gray-500'
                  }`}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Podcasts List */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredPodcasts.map((podcast) => (
          <View
            key={podcast._id}
            className="flex-row bg-white rounded-2xl p-4 mb-4 shadow-sm relative overflow-hidden"
          >
            {/* Thumbnail */}
            <TouchableOpacity 
              className="w-20 h-20 rounded-xl bg-gray-100 items-center justify-center mr-4 relative overflow-hidden"
              onPress={() => handlePlayPodcast(podcast)}
            >
              {podcast.thumbnailUrl && podcast.thumbnailUrl.startsWith('http') ? (
                <Image
                  source={{ uri: podcast.thumbnailUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-4xl">🎙️</Text>
              )}

              {/* Access Indicator Overlay */}
              {podcast.accessType === 'membership' && podcast.canAccess === false && (
                <View className="absolute inset-0 bg-black/30 items-center justify-center">
                  <Ionicons name="lock-closed" size={24} color="white" />
                </View>
              )}
              {podcast.accessType === 'paid' && podcast.canAccess === false && (
                <View className="absolute inset-0 bg-black/30 items-center justify-center">
                  <Ionicons name="lock-closed" size={24} color="white" />
                </View>
              )}
            </TouchableOpacity>

            {/* Content */}
            <View className="flex-1 mr-3">
              <View className="flex-row items-center gap-2 mb-1">
                <Text className="text-base font-bold text-gray-900 flex-1" numberOfLines={1}>{podcast.title}</Text>
                {podcast.accessType === 'membership' && (
                  <View className="px-2 py-0.5 rounded-md bg-blue-100">
                    <Text className="text-[10px] font-semibold text-blue-700">🔐 PREMIUM</Text>
                  </View>
                )}
                {podcast.accessType === 'paid' && (
                  <View className="px-2 py-0.5 rounded-md bg-yellow-100">
                    <Text className="text-[10px] font-semibold text-yellow-700">💰 ₹{podcast.price}</Text>
                  </View>
                )}
              </View>

              <Text className="text-sm text-gray-500 mb-1.5">{podcast.host}</Text>
              <Text className="text-[13px] text-gray-400 mb-2" numberOfLines={1}>{podcast.description}</Text>

              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text className="text-xs text-gray-500">{podcast.duration || '00:00'}</Text>
                </View>
                <View className="px-2 py-1 rounded-xl bg-blue-50">
                  <Text className="text-[11px] font-semibold text-blue-500">{podcast.category}</Text>
                </View>
              </View>
            </View>

            {/* Play/Access Button */}
            {podcast.accessType === 'free' || podcast.canAccess === true ? (
              <TouchableOpacity
                className="w-12 h-12 rounded-full items-center justify-center shadow-lg bg-blue-500"
                onPress={() => handlePlayPodcast(podcast)}
              >
                <Ionicons
                  name="play"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>
            ) : podcast.accessType === 'membership' ? (
              <TouchableOpacity
                className="w-12 h-12 rounded-full items-center justify-center shadow-lg bg-gray-400"
                onPress={() => handlePlayPodcast(podcast)}
              >
                <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="w-12 h-12 rounded-full items-center justify-center shadow-lg bg-purple-500"
                onPress={() => handlePlayPodcast(podcast)}
              >
                <Ionicons name="card" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {filteredPodcasts.length === 0 && !loading && (
          <View className="items-center justify-center py-20">
            <Ionicons name="mic-off-outline" size={64} color="#9CA3AF" />
            <Text className="text-xl font-bold text-gray-900 mt-4 mb-2">No Podcasts Found</Text>
            <Text className="text-sm text-gray-500 text-center">
              {!user ? 'Login to see all available podcasts' : 'No podcasts available in this category'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Video Player Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={!!currentPodcast}
        onRequestClose={closePlayer}
      >
        <SafeAreaView className="flex-1 bg-black">
          {/* Player Header */}
          <View className="flex-row items-center justify-between px-4 py-2 bg-black/50 absolute top-0 left-0 right-0 z-10 w-full mt-12">
            <TouchableOpacity
              onPress={closePlayer}
              className="w-10 h-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md"
            >
              <Ionicons name="chevron-down" size={28} color="white" />
            </TouchableOpacity>
          </View>

          <View className="flex-1 justify-center items-center">
            {currentPodcast && currentPodcast.source === 'local' && currentPodcast.videoUrl ? (
              <Video
                ref={videoRef}
                source={{ uri: currentPodcast.videoUrl }}
                style={{ width: width, height: width * (9 / 16) }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                shouldPlay={true}

                onError={(error) => {
                  Alert.alert('Error', 'Could not load video source');
                }}
              />
            ) : currentPodcast && currentPodcast.source === 'youtube' && currentPodcast.youtubeUrl ? (
              (() => {
                const videoId = extractYouTubeVideoId(currentPodcast.youtubeUrl || '');
                const watchUrl = videoId
                  ? `https://m.youtube.com/watch?v=${videoId}`
                  : currentPodcast.youtubeUrl;
                const externalOpenUrl = videoId
                  ? `https://www.youtube.com/watch?v=${videoId}`
                  : currentPodcast.youtubeUrl;
                const embedUrl = videoId
                  ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&controls=1&enablejsapi=1&origin=https%3A%2F%2Fwww.youtube.com`
                  : null;

                const webViewUrl = youtubeMode === 'watch' ? watchUrl : embedUrl;

                if (!webViewUrl) {
                  return <Text className="text-white text-lg">Invalid YouTube URL</Text>;
                }

                if (youtubePlaybackBlocked) {
                  return (
                    <View style={{ width, height: width * (9 / 16), backgroundColor: '#000' }} className="items-center justify-center px-6">
                      <Ionicons name="alert-circle-outline" size={40} color="#F59E0B" />
                      <Text className="text-white text-base font-semibold mt-3 text-center">This video cannot be played inside the app</Text>
                      <Text className="text-gray-400 text-sm mt-2 text-center">
                        YouTube has blocked embedded playback for this video (error 152/150).
                      </Text>
                      <TouchableOpacity
                        className="mt-4 bg-white px-4 py-2 rounded-lg"
                        onPress={() => openPodcastOnYouTube(externalOpenUrl)}
                      >
                        <Text className="text-black font-semibold text-sm">Open in YouTube app</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View style={{ width, height: width * (9 / 16), backgroundColor: '#000' }}>
                    <WebView
                      source={{
                        uri: webViewUrl,
                        headers: {
                          Referer: 'https://www.youtube.com/',
                          Origin: 'https://www.youtube.com',
                        },
                      }}
                      style={{ flex: 1, backgroundColor: '#000' }}
                      allowsInlineMediaPlayback
                      mediaPlaybackRequiresUserAction={false}
                      allowsFullscreenVideo
                      javaScriptEnabled
                      domStorageEnabled
                      userAgent={YOUTUBE_WEBVIEW_USER_AGENT}
                      startInLoadingState
                      injectedJavaScript={youtubeMode === 'embed' ? YOUTUBE_ERROR_CHECK_SCRIPT : undefined}
                      onMessage={handleYouTubeMessage}
                      onHttpError={() => {
                        if (youtubeMode === 'embed') {
                          setYoutubeMode('watch');
                          return;
                        }

                        setYoutubePlaybackBlocked(true);
                      }}
                      onError={() => {
                        if (youtubeMode === 'embed') {
                          setYoutubeMode('watch');
                          return;
                        }

                        setYoutubePlaybackBlocked(true);
                      }}
                      originWhitelist={['*']}
                    />

                    {youtubeMode === 'watch' && (
                      <View className="absolute bottom-3 right-3">
                        <TouchableOpacity
                          className="bg-white/90 px-3 py-2 rounded-lg"
                          onPress={() => openPodcastOnYouTube(externalOpenUrl)}
                        >
                          <Text className="text-xs font-semibold text-black">Open in YouTube app</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })()
            ) : (
              <Text className="text-white text-lg">Video source not available</Text>
            )}
          </View>

          {/* Player Info */}
          <View className="px-6 pb-10 bg-black">
            {currentPodcast && (
              <>
                <Text className="text-white text-2xl font-bold mb-2">{currentPodcast.title}</Text>
                <Text className="text-gray-400 text-lg mb-4">{currentPodcast.host}</Text>

                <ScrollView className="max-h-40">
                  <Text className="text-gray-300 text-base leading-6">
                    {currentPodcast.description}
                  </Text>
                </ScrollView>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Payment Flow Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showPaymentFlow}
        onRequestClose={() => setShowPaymentFlow(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white rounded-3xl p-6 width-full max-w-xs w-full">
            {/* Close Button */}
            <TouchableOpacity 
              onPress={() => setShowPaymentFlow(false)}
              className="absolute top-4 right-4 w-8 h-8 items-center justify-center"
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>

            {/* Content */}
            {selectedPodcast && (
              <>
                <Text className="text-2xl font-bold text-gray-900 mb-2 pr-6">
                  {selectedPodcast.title}
                </Text>
                <Text className="text-lg text-gray-600 mb-6">{selectedPodcast.host}</Text>

                {/* Price Card */}
                <View className="bg-purple-50 rounded-2xl p-6 mb-6 border border-purple-200">
                  <Text className="text-gray-600 text-sm mb-1">Price</Text>
                  <Text className="text-3xl font-bold text-purple-600">
                    ₹{selectedPodcast.price}
                  </Text>
                  <Text className="text-gray-500 text-xs mt-2">
                    One-time purchase • Lifetime access
                  </Text>
                </View>

                {/* Description */}
                <ScrollView className="max-h-32 mb-6">
                  <Text className="text-gray-600 text-base">
                    {selectedPodcast.description}
                  </Text>
                </ScrollView>

                {/* Purchase Button */}
                <TouchableOpacity
                  className="w-full bg-purple-600 py-4 rounded-xl items-center justify-center"
                  disabled={processingPayment}
                  onPress={() => handlePurchasePodcast(selectedPodcast)}
                >
                  {processingPayment ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white text-lg font-semibold">Purchase Now</Text>
                  )}
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity
                  className="w-full mt-3 py-3 rounded-xl items-center justify-center border border-gray-300"
                  onPress={() => setShowPaymentFlow(false)}
                  disabled={processingPayment}
                >
                  <Text className="text-gray-600 text-base font-semibold">Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
