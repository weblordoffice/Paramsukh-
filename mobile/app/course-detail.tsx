import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCourseStore, Video, Assignment } from '../store/courseStore';
import { useAuthStore } from '../store/authStore';

export default function CourseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const courseId = params.id as string;
  const courseTitle = (params.title as string) || 'Course';
  const courseColor = (params.color as string) || '#8B5CF6';
  const courseDuration = (params.duration as string) || '6 weeks';

  const { currentCourse, fetchCourseById, fetchEnrollmentProgress, enrollmentProgress, isLoading } =
    useCourseStore();
  const { token } = useAuthStore();

  useEffect(() => {
    if (courseId) {
      fetchCourseById(courseId);
      // Only fetch progress if the user is authenticated – avoids the 404
      if (token) {
        fetchEnrollmentProgress(courseId);
      }
    }
  }, [courseId, token]);

  const videos: Video[] = currentCourse?.videos || [];
  const completedVideos = enrollmentProgress?.completedVideos?.length || 0;
  const progressPct = videos.length > 0 ? Math.round((completedVideos / videos.length) * 100) : 0;

  const handleVideoPress = (video: Video) => {
    router.push({
      pathname: '/video-player',
      params: {
        courseId,
        courseTitle,
        courseColor,
        videoId: video._id,
        videoTitle: video.title,
        videoDuration: video.duration,
        videoUrl: video.videoUrl,
      },
    });
  };

  const handleAssignmentPress = (assignment: Assignment) => {
    router.push({
      pathname: '/assignment-viewer',
      params: {
        courseId,
        courseColor,
        assignmentId: assignment._id,
      },
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* ── Back button ── */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={courseColor} />
          <Text style={styles.loadingText}>Loading course…</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* ── Hero Banner ── */}
          <View style={styles.hero}>
            {currentCourse?.thumbnailUrl ? (
              <Image
                source={{ uri: currentCourse.thumbnailUrl }}
                style={styles.heroBg}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.heroBg, { backgroundColor: courseColor + '40' }]} />
            )}
            {/* Gradient-like scrim */}
            <View style={styles.heroScrim} />

            {/* Category badge */}
            {currentCourse?.category && (
              <View style={[styles.heroBadge, { borderColor: courseColor }]}>
                <Ionicons name="shield-checkmark" size={11} color={courseColor} />
                <Text style={[styles.heroBadgeText, { color: courseColor }]}>
                  {currentCourse.category.toUpperCase()}
                </Text>
              </View>
            )}

            {/* Title block */}
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>{courseTitle}</Text>
              <View style={styles.heroMeta}>
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.75)" />
                <Text style={styles.heroMetaText}>{courseDuration}</Text>
                <View style={styles.heroDot} />
                <Ionicons name="play-circle-outline" size={14} color="rgba(255,255,255,0.75)" />
                <Text style={styles.heroMetaText}>{videos.length} videos</Text>
              </View>
            </View>
          </View>

          {/* ── Progress card ── */}
          {token && videos.length > 0 && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Your Progress</Text>
                <Text style={[styles.progressPct, { color: courseColor }]}>{progressPct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: courseColor }]}
                />
              </View>
              <Text style={styles.progressSub}>
                {completedVideos} of {videos.length} videos completed
              </Text>
            </View>
          )}

          {/* ── Description ── */}
          {currentCourse?.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this Course</Text>
              <Text style={styles.descText}>{currentCourse.description}</Text>
            </View>
          ) : null}

          {/* ── Video List ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Course Videos
              <Text style={styles.sectionCount}>  {videos.length}</Text>
            </Text>

            {videos.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="videocam-off-outline" size={40} color="#475569" />
                <Text style={styles.emptyText}>No videos yet</Text>
              </View>
            ) : (
              videos.map((video, idx) => {
                const isCompleted = enrollmentProgress?.completedVideos?.includes(video._id);
                return (
                  <TouchableOpacity
                    key={video._id}
                    style={styles.videoRow}
                    onPress={() => handleVideoPress(video)}
                    activeOpacity={0.75}
                  >
                    {/* Thumb placeholder — numbered play icon */}
                    <View style={styles.videoThumbWrap}>
                      <View style={[styles.videoThumbPlaceholder, { backgroundColor: courseColor + '22' }]}>
                        <Text style={[styles.videoThumbNum, { color: courseColor }]}>
                          {String(idx + 1).padStart(2, '0')}
                        </Text>
                        <Ionicons name="play-circle" size={22} color={courseColor} style={{ marginTop: 2 }} />
                      </View>
                      {/* Duration pill */}
                      {video.duration ? (
                        <View style={styles.durationPill}>
                          <Text style={styles.durationText}>{video.duration}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Info */}
                    <View style={styles.videoInfo}>
                      <Text style={styles.videoIndex}>Lesson {String(idx + 1).padStart(2, '0')}</Text>
                      <Text style={styles.videoTitle} numberOfLines={2}>
                        {video.title}
                      </Text>
                      {video.description ? (
                        <Text style={styles.videoDesc} numberOfLines={1}>
                          {video.description}
                        </Text>
                      ) : null}
                    </View>

                    {/* Completed checkmark */}
                    {isCompleted ? (
                      <View style={[styles.completedBadge, { backgroundColor: '#10B981' }]}>
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#475569" />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* ── Assignment List ── */}
          {currentCourse?.assignments && currentCourse.assignments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Assignments & Quizzes
                <Text style={styles.sectionCount}>  {currentCourse.assignments.length}</Text>
              </Text>

              {currentCourse.assignments.map((assignment, idx) => (
                <TouchableOpacity
                  key={assignment._id}
                  style={styles.videoRow}
                  onPress={() => handleAssignmentPress(assignment)}
                  activeOpacity={0.75}
                >
                  <View style={styles.videoThumbWrap}>
                    <View style={[styles.videoThumbPlaceholder, { backgroundColor: '#8B5CF622' }]}>
                      <Ionicons name="help-circle-outline" size={28} color="#8B5CF6" />
                    </View>
                  </View>

                  <View style={styles.videoInfo}>
                    <Text style={styles.videoIndex}>Assignment {idx + 1}</Text>
                    <Text style={styles.videoTitle} numberOfLines={2}>
                      {assignment.title}
                    </Text>
                    <Text style={styles.videoDesc} numberOfLines={1}>
                      {assignment.questions?.length || 0} Questions
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="#475569" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },

  /* ── Back btn ── */
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    zIndex: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15,23,42,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Loading ── */
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },

  /* ── Hero ── */
  hero: {
    width: '100%',
    height: 240,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.62)',
  },
  heroBadge: {
    position: 'absolute',
    top: 56,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroContent: {
    padding: 20,
    paddingBottom: 22,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
    lineHeight: 28,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  heroDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 2,
  },

  /* ── Progress card ── */
  progressCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  progressPct: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(148,163,184,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  /* ── Sections ── */
  section: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 14,
  },
  sectionCount: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
  },
  descText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
  },

  /* ── Empty ── */
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    color: '#475569',
    fontSize: 14,
  },

  /* ── Video rows ── */
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.1)',
    padding: 10,
    gap: 12,
  },
  videoThumbWrap: {
    width: 80,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  videoThumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  videoThumbNum: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  durationPill: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  durationText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  videoInfo: {
    flex: 1,
  },
  videoIndex: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    lineHeight: 19,
  },
  videoDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  completedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
