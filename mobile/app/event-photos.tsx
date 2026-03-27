import React, { useState , useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, Image, Modal, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useEventStore, EventPhoto } from '../store/eventStore';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3; // 3 columns with padding

export default function EventPhotosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const eventTitle = params.eventTitle as string || 'Event';
  const eventColor = params.eventColor as string || '#8B5CF6';
  const eventEmoji = params.eventEmoji as string || '📸';
  const eventId = params.eventId as string || '';
  const imageCount = parseInt(params.imageCount as string || '0', 10);

  const [selectedPhoto, setSelectedPhoto] = useState<EventPhoto | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // useEventStore for fetching real photos
  const { photos, fetchEventPhotos, isLoading } = useEventStore();

  useEffect(() => {
    if (eventId) {
      fetchEventPhotos(eventId);
    }
  }, [eventId]);

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
            {photos.length} Photo{photos.length !== 1 ? 's' : ''}
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
                <Text className="text-sm text-gray-600">{photos.length} Photo{photos.length !== 1 ? 's' : ''} Available</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-4">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="images" size={16} color={eventColor} />
                <Text className="text-xs font-medium" style={{ color: eventColor }}>
                  Event Gallery
                </Text>
              </View>
            </View>
          </View>

          {/* Photos Grid */}
          <Text className="text-xl font-bold text-gray-900 mb-4">Event Photos</Text>

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
                {/* Overlay on hover/press */}
                <View className="absolute inset-0 bg-black/0 rounded-xl" />
              </TouchableOpacity>
            ))}
          </View>

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

