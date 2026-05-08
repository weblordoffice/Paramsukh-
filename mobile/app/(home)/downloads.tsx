import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useOfflineVideoStore } from '../../store/offlineVideoStore';
import { useAuthStore } from '../../store/authStore';
import { hasActiveMembership } from '../../utils/membership';

export default function DownloadsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { downloads, hydrate, removeDownload, hydrated } = useOfflineVideoStore();
  const isPremiumMember = hasActiveMembership(user);

  useFocusEffect(
    useCallback(() => {
      hydrate();
    }, [hydrate])
  );

  const handleOpenVideo = (videoId: string) => {
    const target = downloads.find((item) => item.videoId === videoId);
    if (!target) return;

    router.push({
      pathname: '/video-player',
      params: {
        courseId: target.courseId,
        courseTitle: target.courseTitle,
        courseColor: target.courseColor,
        videoId: target.videoId,
        videoTitle: target.videoTitle,
        videoDuration: target.videoDuration,
        videoUrl: target.localUri,
      },
    });
  };

  const handleRemove = async (videoId: string) => {
    const ok = await removeDownload(videoId);
    if (!ok) {
      Alert.alert('Error', 'Could not remove downloaded video.');
    }
  };

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isPremiumMember) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Downloaded Videos</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={52} color="#9CA3AF" />
          <Text style={styles.lockTitle}>Premium Only</Text>
          <Text style={styles.lockText}>
            Offline video downloads are available only with an active membership.
          </Text>
          <TouchableOpacity style={styles.membershipBtn} onPress={() => router.push('/(home)/my-membership')}>
            <Text style={styles.membershipBtnText}>View Membership</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Downloaded Videos</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Videos saved here stay inside the app and can be watched offline.
        </Text>

        {downloads.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="download-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No Downloads Yet</Text>
            <Text style={styles.emptyText}>
              Open a premium course video and tap the download button to save it offline.
            </Text>
          </View>
        ) : (
          downloads.map((item) => (
            <View key={item.videoId} style={styles.card}>
              <TouchableOpacity style={styles.cardMain} onPress={() => handleOpenVideo(item.videoId)} activeOpacity={0.8}>
                <View style={[styles.iconWrap, { backgroundColor: item.courseColor + '20' }]}>
                  <Ionicons name="play-circle" size={26} color={item.courseColor} />
                </View>
                <View style={styles.meta}>
                  <Text style={styles.courseTitle} numberOfLines={1}>{item.courseTitle}</Text>
                  <Text style={styles.videoTitle} numberOfLines={2}>{item.videoTitle}</Text>
                  <Text style={styles.metaText}>
                    {item.videoDuration} • Downloaded {new Date(item.downloadedAt).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.videoId)}>
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    marginLeft: 14,
  },
  courseTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  metaText: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
  },
  removeBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  removeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  lockTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  lockText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#6B7280',
  },
  membershipBtn: {
    marginTop: 18,
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  membershipBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
