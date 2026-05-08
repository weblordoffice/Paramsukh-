import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Dimensions, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useEventStore, EventVideo, EventPhoto } from '../store/eventStore';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3;

export default function EventMediaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const eventTitle = params.eventTitle as string || 'Event';
  const eventColor = params.eventColor as string || '#8B5CF6';
  const eventEmoji = params.eventEmoji as string || '📸';
  const eventId = params.eventId as string || '';
  const initialTab = params.initialTab as string || 'videos';

  const [activeTab, setActiveTab] = useState<'videos' | 'photos'>(initialTab as 'videos' | 'photos');
  
  // Photo modal state
  const [selectedPhoto, setSelectedPhoto] = useState<EventPhoto | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { videos, photos, fetchEventDetails, isLoading } = useEventStore();

  useEffect(() => {
    if (eventId) {
      // fetchEventDetails fetches both videos and photos simultaneously
      fetchEventDetails(eventId);
    }
  }, [eventId, fetchEventDetails]);

  const handleVideoPress = (video: EventVideo) => {
    router.push({
      pathname: '/video-player',
      params: {
        courseTitle: eventTitle,
        courseColor: eventColor,
        videoTitle: video.title || 'Event Recording',
        videoDuration: video.duration || '',
        videoUrl: video.url,
      }
    });
  };

  const handlePhotoPress = (photo: EventPhoto) => {
    setSelectedPhoto(photo);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedPhoto(null);
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!selectedPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    if (direction === 'prev' && currentIndex > 0) {
      setSelectedPhoto(photos[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < photos.length - 1) {
      setSelectedPhoto(photos[currentIndex + 1]);
    }
  };

  const currentPhotoIndex = selectedPhoto ? photos.findIndex(p => p.id === selectedPhoto.id) + 1 : 0;

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
            Event Media
          </Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View className="flex-row bg-white border-b border-gray-200">
        <TouchableOpacity 
          className="flex-1 py-4 items-center border-b-2"
          style={{ borderColor: activeTab === 'videos' ? eventColor : 'transparent' }}
          onPress={() => setActiveTab('videos')}
        >
          <Text style={{ color: activeTab === 'videos' ? eventColor : '#6B7280', fontWeight: activeTab === 'videos' ? '700' : '500' }}>
            Recordings ({videos.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className="flex-1 py-4 items-center border-b-2"
          style={{ borderColor: activeTab === 'photos' ? eventColor : 'transparent' }}
          onPress={() => setActiveTab('photos')}
        >
          <Text style={{ color: activeTab === 'photos' ? eventColor : '#6B7280', fontWeight: activeTab === 'photos' ? '700' : '500' }}>
            Gallery ({photos.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="p-4">
          
          {isLoading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator size="large" color={eventColor} />
              <Text className="text-gray-500 mt-4">Loading media...</Text>
            </View>
          ) : activeTab === 'videos' ? (
            <>
              {videos.length === 0 ? (
                <View className="py-20 items-center justify-center">
                  <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
                    <Ionicons name="videocam-off" size={40} color="#9CA3AF" />
                  </View>
                  <Text className="text-lg font-bold text-gray-900 mb-1">No Recordings Yet</Text>
                  <Text className="text-sm text-gray-500 text-center px-6">
                    Check back later. Event recordings are usually uploaded within 48 hours.
                  </Text>
                </View>
              ) : (
                videos.map((video, index) => (
                  <TouchableOpacity
                    key={video.id}
                    style={styles.videoCard}
                    onPress={() => handleVideoPress(video)}
                    activeOpacity={0.8}
                  >
                    {/* Video Thumbnail */}
                    <View className="relative">
                      <View
                        className="w-full rounded-t-xl items-center justify-center overflow-hidden"
                        style={{
                          height: 180,
                          backgroundColor: eventColor + '20'
                        }}
                      >
                        {video.thumbnailUrl ? (
                          <Image source={{ uri: video.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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
                          <Text className="text-xs font-semibold text-white">{video.duration || 'Video'}</Text>
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
                        {video.title || `Event Recording ${index + 1}`}
                      </Text>
                      {video.description && (
                        <Text className="text-sm text-gray-600 mb-3" numberOfLines={2}>
                          {video.description}
                        </Text>
                      )}
                      <View className="flex-row items-center gap-3">
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="time-outline" size={14} color="#6B7280" />
                          <Text className="text-xs text-gray-500">{video.duration || 'Full length'}</Text>
                        </View>
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="play-circle-outline" size={14} color="#6B7280" />
                          <Text className="text-xs text-gray-500">Watch Now</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </>
          ) : (
            <>
              {photos.length === 0 ? (
                <View className="py-20 items-center justify-center">
                  <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
                    <Ionicons name="images-outline" size={40} color="#9CA3AF" />
                  </View>
                  <Text className="text-lg font-bold text-gray-900 mb-1">No Photos Yet</Text>
                  <Text className="text-sm text-gray-500 text-center px-6">
                    Check back later. Event photos are usually uploaded shortly after the event concludes.
                  </Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {photos.map((photo) => (
                    <TouchableOpacity
                      key={photo.id}
                      onPress={() => handlePhotoPress(photo)}
                      activeOpacity={0.8}
                      style={[
                        styles.photoItem,
                        {
                          width: PHOTO_SIZE,
                          height: PHOTO_SIZE,
                        }
                      ]}
                    >
                      {photo.thumbnailUrl ? (
                        <Image
                          source={{ uri: photo.thumbnailUrl }}
                          style={styles.photoImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          className="w-full h-full items-center justify-center rounded-xl"
                          style={{ backgroundColor: eventColor + '20' }}
                        >
                          <Ionicons name="image" size={32} color={eventColor} />
                        </View>
                      )}
                      <View className="absolute inset-0 bg-black/0 rounded-xl" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Bottom spacing */}
          <View className="h-[100px]" />
        </View>
      </ScrollView>

      {/* Full Screen Photo Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          {/* Top Bar */}
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={closeModal} style={styles.modalButton}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalCounter}>
              {currentPhotoIndex} / {photos.length}
            </Text>
            <View style={styles.modalButton} />
          </View>

          {/* Photo Display */}
          <View style={styles.modalPhotoContainer}>
            {selectedPhoto && (
              <View style={styles.modalPhotoWrapper}>
                {selectedPhoto.url ? (
                  <Image
                    source={{ uri: selectedPhoto.url }}
                    style={styles.modalPhoto}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={[styles.modalPhotoPlaceholder, { backgroundColor: eventColor + '20' }]}
                    className="items-center justify-center"
                  >
                    <Ionicons name="image" size={80} color={eventColor} />
                    <Text style={[styles.modalPlaceholderText, { color: eventColor }]}>
                      {selectedPhoto.caption}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Navigation Arrows */}
            <TouchableOpacity
              style={[styles.navArrow, styles.navArrowLeft]}
              onPress={() => navigatePhoto('prev')}
              disabled={currentPhotoIndex <= 1}
            >
              <Ionicons
                name="chevron-back"
                size={32}
                color={currentPhotoIndex <= 1 ? '#666' : '#FFFFFF'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navArrow, styles.navArrowRight]}
              onPress={() => navigatePhoto('next')}
              disabled={currentPhotoIndex >= photos.length}
            >
              <Ionicons
                name="chevron-forward"
                size={32}
                color={currentPhotoIndex >= photos.length ? '#666' : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>

          {/* Bottom Bar with Caption */}
          {selectedPhoto?.caption && (
            <View style={styles.modalBottomBar}>
              <Text style={styles.modalCaption} numberOfLines={2}>
                {selectedPhoto.caption}
              </Text>
            </View>
          )}
        </View>
      </Modal>
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
  photoItem: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  modalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCounter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalPhotoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPhotoWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPhoto: {
    width: '100%',
    height: '100%',
  },
  modalPhotoPlaceholder: {
    width: '80%',
    height: '60%',
    borderRadius: 20,
  },
  modalPlaceholderText: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -25,
  },
  navArrowLeft: {
    left: 20,
  },
  navArrowRight: {
    right: 20,
  },
  modalBottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  modalCaption: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
