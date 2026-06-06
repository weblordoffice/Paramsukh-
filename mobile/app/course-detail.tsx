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
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import AmbientGlow from '../components/AmbientGlow';
import { useCourseStore, Video, Assignment, Pdf } from '../store/courseStore';
import { useAuthStore } from '../store/authStore';

function LessonCard({ children, onPress, style, isLocked, ...props }: any) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (isLocked) return;
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (isLocked) return;
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 45,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={isLocked ? 0.95 : 0.8}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      {...props}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

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
  }, [courseId, token, fetchCourseById, fetchEnrollmentProgress]);

  const videos: Video[] = [...(currentCourse?.videos || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const totalPdfs = currentCourse?.pdfs?.length || 0;
  const completedVideos = enrollmentProgress?.completedVideos?.length || 0;
  const completedPdfs = enrollmentProgress?.completedPdfs?.length || 0;
  
  // Use backend progress percentage, falling back to calculation
  const progressPct = enrollmentProgress?.progress !== undefined 
    ? enrollmentProgress.progress 
    : (videos.length + totalPdfs > 0 
        ? Math.round(((completedVideos + completedPdfs) / (videos.length + totalPdfs)) * 100) 
        : 0);

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

  const handlePdfPress = async (pdf: Pdf) => {
    let url = pdf.pdfUrl || '';
    if (!url) return;
    try {
      if (Platform.OS === 'android') {
        const isLocal = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('10.0.2.2') || url.includes('192.168.');
        if (!isLocal) {
          url = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
        }
      }

      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        enableBarCollapsing: true,
        showTitle: true,
      });
      // Mark as completed
      if (token && courseId) {
        await useCourseStore.getState().markPdfComplete(courseId, pdf._id);
        // Refresh progress
        fetchEnrollmentProgress(courseId);
      }
    } catch (e) {
      console.error('Error opening PDF:', e);
    }
  };

  return (
    <AmbientGlow style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

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

          {/* Header Spacer to push intro below back button */}
          <View style={styles.headerSpacer} />

          {/* ── Calm Course Intro Section ── */}
          <View style={styles.introSection}>
            {currentCourse?.thumbnailUrl ? (
              <Image
                source={{ uri: currentCourse.thumbnailUrl }}
                style={styles.courseThumb}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.courseThumb, { backgroundColor: courseColor + '22', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="book" size={48} color={courseColor} />
              </View>
            )}

            {currentCourse?.category && (
              <View style={[styles.categoryBadge, { borderColor: courseColor + '33', backgroundColor: courseColor + '10' }]}>
                <Ionicons name="sparkles-outline" size={11} color={courseColor} />
                <Text style={[styles.categoryBadgeText, { color: courseColor }]}>
                  {currentCourse.category.toUpperCase()}
                </Text>
              </View>
            )}

            <Text style={styles.courseTitleHeader}>{courseTitle}</Text>
            
            <View style={styles.courseMetaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color="#94A3B8" />
                <Text style={styles.metaText}>{courseDuration}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Ionicons name="play-circle-outline" size={14} color="#94A3B8" />
                <Text style={styles.metaText}>{videos.length} lessons</Text>
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
                {completedVideos} of {videos.length} videos {totalPdfs > 0 ? `& ${completedPdfs} of ${totalPdfs} PDFs ` : ''}completed
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
                const isLocked = currentCourse?.strictVideoOrder && idx > 0 && !enrollmentProgress?.completedVideos?.includes(videos[idx - 1]._id);
                return (
                  <LessonCard
                    key={video._id}
                    style={[styles.videoRow, isLocked && { opacity: 0.55 }]}
                    isLocked={isLocked}
                    onPress={() => {
                      if (isLocked) {
                        Alert.alert(
                          'Lesson Locked',
                          'Please watch and complete the previous video lessons in order to unlock this one.',
                          [{ text: 'OK' }]
                        );
                      } else {
                        handleVideoPress(video);
                      }
                    }}
                  >
                    {/* Thumb placeholder — numbered play icon or lock */}
                    <View style={styles.videoThumbWrap}>
                      <View style={[styles.videoThumbPlaceholder, { backgroundColor: isLocked ? 'rgba(51, 65, 85, 0.3)' : courseColor + '22' }]}>
                        {isLocked ? (
                          <Ionicons name="lock-closed" size={20} color="#64748B" />
                        ) : (
                          <>
                            <Text style={[styles.videoThumbNum, { color: courseColor }]}>
                              {String(idx + 1).padStart(2, '0')}
                            </Text>
                            <Ionicons name="play-circle" size={20} color={courseColor} style={{ marginTop: 2 }} />
                          </>
                        )}
                      </View>
                      {/* Duration pill */}
                      {video.duration && !isLocked ? (
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

                    {/* Completed checkmark or lock */}
                    {isCompleted ? (
                      <View style={[styles.completedBadge, { backgroundColor: '#10B981' }]}>
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      </View>
                    ) : isLocked ? (
                      <Ionicons name="lock-closed-outline" size={18} color="#475569" />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#475569" />
                    )}
                  </LessonCard>
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
                <LessonCard
                  key={assignment._id}
                  style={styles.videoRow}
                  onPress={() => handleAssignmentPress(assignment)}
                >
                  <View style={styles.videoThumbWrap}>
                    <View style={[styles.videoThumbPlaceholder, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                      <Ionicons name="help-circle-outline" size={24} color="#8B5CF6" />
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
                </LessonCard>
              ))}
            </View>
          )}

          {/* ── PDF Resources List ── */}
          {currentCourse?.pdfs && currentCourse.pdfs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Study Materials & PDFs
                <Text style={styles.sectionCount}>  {currentCourse.pdfs.length}</Text>
              </Text>

              {currentCourse.pdfs.map((pdf, idx) => {
                const isCompleted = enrollmentProgress?.completedPdfs?.includes(pdf._id);
                return (
                  <LessonCard
                    key={pdf._id}
                    style={styles.videoRow}
                    onPress={() => handlePdfPress(pdf)}
                  >
                    <View style={styles.videoThumbWrap}>
                      {pdf.thumbnailUrl ? (
                        <Image source={{ uri: pdf.thumbnailUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      ) : (
                        <View style={[styles.videoThumbPlaceholder, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                          <Ionicons name="document-text-outline" size={24} color="#10B981" />
                        </View>
                      )}
                    </View>

                    <View style={styles.videoInfo}>
                      <Text style={[styles.videoIndex, { color: '#10B981' }]}>Document {idx + 1}</Text>
                      <Text style={styles.videoTitle} numberOfLines={2}>
                        {pdf.title}
                      </Text>
                      <Text style={styles.videoDesc} numberOfLines={1}>
                        {pdf.fileSize ? `${pdf.fileSize} • ` : ''}{pdf.description || 'Downloadable PDF resource'}
                      </Text>
                    </View>

                    {isCompleted ? (
                      <View style={[styles.completedBadge, { backgroundColor: '#10B981' }]}>
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#475569" />
                    )}
                  </LessonCard>
                );
              })}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </AmbientGlow>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  /* ── Back btn ── */
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
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

  /* ── Calm Course Intro Section ── */
  headerSpacer: {
    height: 104,
  },
  introSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  courseThumb: {
    width: 140,
    height: 140,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  courseTitleHeader: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  courseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  metaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  /* ── Progress card ── */
  progressCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CBD5E1',
    letterSpacing: 0.2,
  },
  progressPct: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressSub: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },

  /* ── Sections ── */
  section: {
    marginTop: 26,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  sectionCount: {
    fontSize: 15,
    fontWeight: '600',
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
    color: '#64748B',
    fontSize: 14,
  },

  /* ── Video rows ── */
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    gap: 14,
  },
  videoThumbWrap: {
    width: 80,
    height: 68,
    borderRadius: 12,
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
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  durationPill: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(8, 12, 22, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 10,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  videoInfo: {
    flex: 1,
  },
  videoIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '700',
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
