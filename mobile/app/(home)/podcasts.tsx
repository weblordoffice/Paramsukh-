import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

const { width } = Dimensions.get('window');

interface Podcast {
  _id: string;
  title: string;
  host: string;
  duration: string;
  category: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  isPlaying?: boolean;
}

export default function PodcastsScreen() {
  const router = useRouter();
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Video Player State
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null);
  const [videoStatus, setVideoStatus] = useState<AVPlaybackStatus | null>(null);
  const videoRef = useRef<Video>(null);

  const categories = ['All', 'Meditation', 'Discourse', 'Scripture', 'Mindfulness', 'Mantra', 'Other'];

  const fetchPodcasts = async () => {
    try {
      const response = await axios.get(`${API_URL}/podcasts`);
      if (response.data && response.data.success) {
        setPodcasts(response.data.data.podcasts.map((p: any) => ({ ...p, isPlaying: false })));
      }
    } catch (error: any) {
      console.error('Error fetching podcasts:', error);
      if (error.response?.status === 404) {
        console.log('Podcasts endpoint not found (404). Backend might need a restart.');
        setPodcasts([]);
      } else {
        Alert.alert('Error', 'Failed to load podcasts');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPodcasts();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPodcasts();
  }, []);

  const handlePlayPodcast = (podcast: Podcast) => {
    if (!podcast.videoUrl) {
      Alert.alert('Unavailable', 'No video/audio source available for this podcast.');
      return;
    }
    setCurrentPodcast(podcast);
  };

  const closePlayer = () => {
    setCurrentPodcast(null);
  };

  const filteredPodcasts =
    selectedCategory === 'All'
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
          <TouchableOpacity
            key={podcast._id}
            className="flex-row bg-white rounded-2xl p-4 mb-4 shadow-sm"
            onPress={() => handlePlayPodcast(podcast)}
            activeOpacity={0.7}
          >
            <View className="w-20 h-20 rounded-xl bg-gray-100 items-center justify-center mr-4 relative overflow-hidden">
              {podcast.thumbnailUrl && podcast.thumbnailUrl.startsWith('http') ? (
                <Image
                  source={{ uri: podcast.thumbnailUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-4xl">🎙️</Text>
              )}
            </View>

            <View className="flex-1 mr-3">
              <Text className="text-base font-bold text-gray-900 mb-1" numberOfLines={1}>{podcast.title}</Text>
              <Text className="text-sm text-gray-500 mb-1.5">{podcast.host}</Text>
              <Text className="text-[13px] text-gray-400 mb-2" numberOfLines={2}>{podcast.description}</Text>

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

            <TouchableOpacity
              className="w-12 h-12 rounded-full items-center justify-center shadow-lg bg-blue-500"
              onPress={() => handlePlayPodcast(podcast)}
            >
              <Ionicons
                name="play"
                size={20}
                color="#FFFFFF"
                style={{ marginLeft: 3 }} // Visual centering fix for play icon
              />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {filteredPodcasts.length === 0 && !loading && (
          <View className="items-center justify-center py-20">
            <Ionicons name="mic-off-outline" size={64} color="#9CA3AF" />
            <Text className="text-xl font-bold text-gray-900 mt-4 mb-2">No Podcasts Found</Text>
            <Text className="text-sm text-gray-500 text-center">
              No podcasts available in this category yet.
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
            {currentPodcast && (
              <Video
                ref={videoRef}
                source={{ uri: currentPodcast.videoUrl }}
                style={{ width: width, height: width * (9 / 16) }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                shouldPlay={true}
                onPlaybackStatusUpdate={status => setVideoStatus(status)}
                onError={(error) => {
                  console.error('Video Load Error:', error);
                  Alert.alert('Error', 'Could not load video source');
                }}
              />
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
    </SafeAreaView>
  );
}
