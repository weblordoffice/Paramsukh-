import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../utils/apiClient';
import { API_URL } from '../../config/api';

interface EligibleCourse {
  _id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  icon?: string;
  color?: string;
  duration?: string;
  category?: string;
  totalVideos?: number;
  totalPdfs?: number;
  alreadySelected: boolean;
}

export default function ChooseCoursesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ membershipId: string; maxSelectable: string }>();
  const membershipId = params.membershipId;
  const maxSelectable = parseInt(params.maxSelectable || '0', 10);

  const [courses, setCourses] = useState<EligibleCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [remaining, setRemaining] = useState(maxSelectable);

  useEffect(() => {
    if (membershipId) {
      fetchEligibleCourses();
      fetchSelectionStatus();
    }
  }, [membershipId]);

  const fetchEligibleCourses = async () => {
    try {
      const { data } = await apiClient.get(`${API_URL}/membership/${membershipId}/eligible-courses`);
      if (data.success) {
        setCourses(data.courses);
      }
    } catch (error) {
      console.error('Failed to fetch eligible courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectionStatus = async () => {
    try {
      const { data } = await apiClient.get(`${API_URL}/membership/${membershipId}/selection-status`);
      if (data.success) {
        setRemaining(data.remaining);
        setSelectedCount(data.used);
      }
    } catch (error) {
      console.error('Failed to fetch selection status:', error);
    }
  };

  const handleSelect = async (course: EligibleCourse) => {
    if (remaining <= 0) {
      Alert.alert('No Credits', 'You have used all your course credits.');
      return;
    }

    if (course.alreadySelected) {
      Alert.alert('Already Selected', 'This course is already in your library.');
      return;
    }

    setSelecting(course._id);
    try {
      const { data } = await apiClient.post(`${API_URL}/membership/${membershipId}/select-course`, {
        courseId: course._id,
      });

      if (data.success) {
        setCourses((prev) =>
          prev.map((c) => (c._id === course._id ? { ...c, alreadySelected: true } : c))
        );
        setRemaining(data.remainingCredits);
        setSelectedCount((prev) => prev + 1);
        Alert.alert('Course Selected', `"${course.title}" added to your library.`);
      } else {
        Alert.alert('Error', data.message || 'Failed to select course.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to select course.');
    } finally {
      setSelecting(null);
    }
  };

  const getCategoryBadge = (category: string = '') => {
    const configs: Record<string, { color: string; bg: string }> = {
      physical: { color: '#FFF', bg: '#EF4444' },
      mental: { color: '#FFF', bg: '#8B5CF6' },
      financial: { color: '#1A1A1A', bg: '#22C55E' },
      relationship: { color: '#FFF', bg: '#EC4899' },
      spiritual: { color: '#FFF', bg: '#F59E0B' },
      general: { color: '#FFF', bg: '#64748B' },
    };
    return configs[category.toLowerCase()] || { color: '#FFF', bg: '#8B5CF6' };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading courses...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Choose Your Courses</Text>
          <Text style={styles.headerSub}>
            {remaining > 0
              ? `${remaining} of ${maxSelectable} credits remaining`
              : 'All credits used'}
          </Text>
        </View>
        {selectedCount > 0 && (
          <View style={styles.creditsBadge}>
            <Text style={styles.creditsBadgeText}>{remaining}</Text>
          </View>
        )}
      </View>

      {maxSelectable === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
          <Text style={styles.emptyTitle}>All Done</Text>
          <Text style={styles.emptySub}>All course credits have been used.</Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.replace('/(home)/courses')}
          >
            <Text style={styles.doneBtnText}>View My Courses</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {courses.map((course) => {
            const badge = getCategoryBadge(course.category);
            return (
              <TouchableOpacity
                key={course._id}
                style={[styles.card, course.alreadySelected && styles.cardSelected]}
                onPress={() => handleSelect(course)}
                disabled={selecting === course._id || course.alreadySelected}
                activeOpacity={0.7}
              >
                <View style={[styles.cardThumb, { backgroundColor: course.color || '#8B5CF6' }]}>
                  {course.thumbnailUrl ? (
                    <Image source={{ uri: course.thumbnailUrl }} style={styles.thumbImage} />
                  ) : (
                    <Ionicons
                      name={(course.icon as any) || 'book-outline'}
                      size={28}
                      color="#FFF"
                    />
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {course.title}
                  </Text>
                  <View style={styles.cardMeta}>
                    {course.category && (
                      <View style={[styles.categoryPill, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.categoryText, { color: badge.color }]}>
                          {course.category}
                        </Text>
                      </View>
                    )}
                    {course.duration && (
                      <Text style={styles.durationText}>{course.duration}</Text>
                    )}
                    {(course.totalVideos || 0) > 0 && (
                      <Text style={styles.metaText}>
                        <Ionicons name="videocam-outline" size={12} /> {course.totalVideos}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.cardAction}>
                  {selecting === course._id ? (
                    <ActivityIndicator size="small" color="#8B5CF6" />
                  ) : course.alreadySelected ? (
                    <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
                  ) : remaining <= 0 ? (
                    <Ionicons name="lock-closed" size={24} color="#9CA3AF" />
                  ) : (
                    <View style={styles.selectBtn}>
                      <Ionicons name="add-circle-outline" size={28} color="#8B5CF6" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          {courses.length === 0 && (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>No eligible courses</Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {remaining > 0 && selectedCount > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => router.replace('/(home)/courses')}
          >
            <Text style={styles.footerBtnText}>
              Done ({selectedCount} selected) — View My Courses
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#64748B', marginTop: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  creditsBadge: {
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsBadgeText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  list: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
    opacity: 0.8,
  },
  cardThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  thumbImage: { width: 56, height: 56, borderRadius: 12 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  categoryPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  categoryText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  durationText: { fontSize: 11, color: '#94A3B8' },
  metaText: { fontSize: 11, color: '#94A3B8' },
  cardAction: { marginLeft: 12, width: 36, alignItems: 'center' },
  selectBtn: { padding: 4 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  footerBtn: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  footerBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  doneBtn: {
    marginTop: 16,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  doneBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
});
