import React, { useState , useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useEventStore, EventVideo } from '../store/eventStore';

const { width } = Dimensions.get('window');




export default function EventVideosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const eventTitle = params.eventTitle as string || 'Event';
  const eventColor = params.eventColor as string || '#8B5CF6';
  const eventEmoji = params.eventEmoji as string || '🎥';
  const eventId = params.eventId as string || '';

  // Mock video data - in real app, fetch from API based on eventId
  const { videos, fetchEventVideos, isLoading } = useEventStore();

  useEffect(() => {
    if (eventId) {
      fetchEventVideos(eventId);
    }
  }, [eventId]);

  const handleVideoPress = (video: EventVideo) => {
    router.push({
      pathname: '/video-player',
      params: {
        courseTitle: eventTitle,
        courseColor: eventColor,
        videoTitle: video.title,
        videoDuration: video.duration,
        videoUrl: video.url, // Pass the YouTube URL
      }
    });
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View
        className="flex-row items-center pt-[50px] px-4 pb-4"
        style={{ backgroundColor: eventColor }}
      >
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-semibold text-white" numberOfLines={1}>
            {eventTitle}
          </Text>
          <Text className="text-xs text-white/80" numberOfLines={1}>
            Event Recordings
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="p-4">
          {/* Event Info Banner */}
          <View
            className="rounded-2xl p-5 mb-6"
            style={{ backgroundColor: eventColor + '15' }}
          >
            <View className="flex-row items-center gap-3 mb-3">
              <Text className="text-4xl">{eventEmoji}</Text>
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-900 mb-1">{eventTitle}</Text>
                <Text className="text-sm text-gray-600">{videos.length} Recording{videos.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-4">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="videocam" size={16} color={eventColor} />
                <Text className="text-xs font-medium" style={{ color: eventColor }}>
                  Full Event Coverage
                </Text>
              </View>
            </View>
          </View>

          {/* Videos List */}
          <Text className="text-xl font-bold text-gray-900 mb-4">All Recordings</Text>

          {videos.map((video, index) => (
            <TouchableOpacity
              key={video.id}
              style={styles.videoCard}
              onPress={() => handleVideoPress(video)}
              activeOpacity={0.8}
            >
              {/* Video Thumbnail */}
              <View className="relative">
                <View
                  className="w-full rounded-t-xl items-center justify-center"
                  style={{
                    height: 180,
                    backgroundColor: eventColor + '20'
                  }}
                >
                  {video.thumbnailUrl ? (
                    <View className="w-full h-full rounded-t-xl bg-gray-200" />
                  ) : (
                    <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center">
                      <Ionicons name="play" size={40} color={eventColor} />
                    </View>
                  )}
                  {/* Play Button Overlay */}
                  <View className="absolute inset-0 items-center justify-center">
                    <View
                      className="w-16 h-16 rounded-full items-center justify-center"
                      style={{ backgroundColor: eventColor + 'E6' }}
                    >
                      <Ionicons name="play" size={28} color="#FFFFFF" />
                    </View>
                  </View>
                  {/* Duration Badge */}
                  <View
                    className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                  >
                    <Text className="text-xs font-semibold text-white">{video.duration}</Text>
                  </View>
                  {/* Video Number Badge */}
                  <View
                    className="absolute top-3 left-3 px-2.5 py-1 rounded-lg"
                    style={{ backgroundColor: eventColor }}
                  >
                    <Text className="text-xs font-bold text-white">Part {index + 1}</Text>
                  </View>
                </View>
              </View>

              {/* Video Info */}
              <View className="p-4 bg-white rounded-b-xl">
                <Text className="text-base font-bold text-gray-900 mb-1.5" numberOfLines={2}>
                  {video.title}
                </Text>
                {video.description && (
                  <Text className="text-sm text-gray-600 mb-3" numberOfLines={2}>
                    {video.description}
                  </Text>
                )}
                <View className="flex-row items-center gap-3">
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="time-outline" size={14} color="#6B7280" />
                    <Text className="text-xs text-gray-500">{video.duration}</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="play-circle-outline" size={14} color="#6B7280" />
                    <Text className="text-xs text-gray-500">Watch Now</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Bottom spacing */}
          <View className="h-[100px]" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  videoCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
});

