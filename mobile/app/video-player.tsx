import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { WebView } from 'react-native-webview';
import { useCourseStore, Assignment } from '../store/courseStore';
import { useAuthStore } from '../store/authStore';
import { useOfflineVideoStore } from '../store/offlineVideoStore';
import { hasActiveMembership } from '../utils/membership';

const { width } = Dimensions.get('window');

// Direct video URLs (Cloudinary, .mp4, etc.) — play in-app. Others — open in browser.
function isDirectVideoUrl(url: string): boolean {
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
}

function getYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function VideoPlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { markVideoComplete, currentCourse } = useCourseStore();
  const { token, user } = useAuthStore();
  const {
    hydrate,
    getDownload,
    downloadVideo,
    removeDownload,
    progressByVideoId,
    activeDownloads,
  } = useOfflineVideoStore();

  const courseTitle = (params.courseTitle as string) || 'Course';
  const courseColor = (params.courseColor as string) || '#8B5CF6';
  const videoTitle = (params.videoTitle as string) || 'Video';
  const videoDuration = (params.videoDuration as string) || '0:00';
  const videoUrl = params.videoUrl as string;
  const courseId = params.courseId as string;
  const videoId = params.videoId as string;

  // Find linked assignments
  const video = currentCourse?.videos?.find(v => v._id === videoId);
  const assignments = video?.assignments || [];

  const ytId = getYouTubeId(videoUrl);
  const isYouTube = !!ytId;
  const useNativePlayer = !isYouTube && videoUrl && isDirectVideoUrl(videoUrl);
  const localDownload = getDownload(videoId);
  const effectiveVideoUrl = localDownload?.localUri || videoUrl;
  const isOfflinePlayback = !!localDownload?.localUri && effectiveVideoUrl === localDownload.localUri;
  const canDownloadOffline = !!videoId && !!courseId && !!videoUrl && isDirectVideoUrl(videoUrl);
  const isPremiumMember = hasActiveMembership(user);
  const downloadProgress = progressByVideoId[videoId] || 0;
  const downloadInProgress = !!activeDownloads[videoId];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marked, setMarked] = useState(false);

  // expo-video player (only created when needed)
  const player = useVideoPlayer(
    useNativePlayer ? { uri: effectiveVideoUrl } : null,
    (p) => {
      p.loop = false;
      p.play();
    }
  );

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  const markComplete = useCallback(async () => {
    if (!token || !courseId || !videoId || marked) return;
    const ok = await markVideoComplete(courseId, videoId);
    if (ok) setMarked(true);
  }, [courseId, videoId, token, marked, markVideoComplete]);

  const handleExternalPlay = async () => {
    if (!videoUrl) return;
    markComplete();
    await WebBrowser.openBrowserAsync(videoUrl);
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

  const handleDownloadPress = async () => {
    if (!isPremiumMember) {
      Alert.alert(
        'Premium Members Only',
        'Offline downloads are available only for users with an active membership.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Membership', onPress: () => router.push('/(home)/my-membership') }
        ]
      );
      return;
    }

    if (!canDownloadOffline) {
      Alert.alert('Unavailable', 'This video source cannot be downloaded for offline viewing.');
      return;
    }

    const result = await downloadVideo({
      videoId,
      courseId,
      courseTitle,
      courseColor,
      videoTitle,
      videoDuration,
      remoteUrl: videoUrl,
    });

    if (!result.success) {
      Alert.alert('Download Failed', result.message || 'Could not download this video.');
      return;
    }

    Alert.alert('Downloaded', 'This video is now available inside the app for offline viewing.');
  };

  const handleRemoveDownload = async () => {
    const ok = await removeDownload(videoId);
    if (!ok) {
      Alert.alert('Error', 'Failed to remove downloaded video.');
      return;
    }

    Alert.alert('Removed', 'Downloaded video removed from this device.');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: courseColor }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerCourse} numberOfLines={1}>{courseTitle}</Text>
          <Text style={styles.headerVideo} numberOfLines={1}>{videoTitle}</Text>
        </View>
      </View>

      {/* ── Video area ── */}
      <View style={styles.videoArea}>
        {isYouTube ? (
          <View style={styles.videoBox}>
            <WebView
              style={styles.videoView}
              source={{ uri: `https://www.youtube.com/embed/${ytId}?playsinline=1` }}
              allowsFullscreenVideo
              javaScriptEnabled
              scrollEnabled={false}
              onLoad={() => {
                setLoading(false);
                markComplete();
              }}
            />
          </View>
        ) : useNativePlayer ? (
          <View style={styles.videoBox}>
            <VideoView
              player={player}
              style={styles.videoView}
              allowsFullscreen
              allowsPictureInPicture
              onLayout={() => {
                setLoading(false);
                markComplete();
              }}
            />
            {loading && (
            <View style={styles.videoOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}
            {error && (
              <View style={styles.videoOverlay}>
                <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={[styles.dismissBtn, { backgroundColor: courseColor }]}
                  onPress={() => setError(null)}
                >
                  <Text style={styles.dismissText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* External / unsupported URL — show play button that opens browser */
          <View style={styles.videoBox}>
            <View style={styles.extPlayerBg} />
            <TouchableOpacity
              style={[styles.extPlayBtn, { backgroundColor: courseColor + 'E6' }]}
              onPress={handleExternalPlay}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={48} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.extPlayHint}>Tap to open in browser</Text>
          </View>
        )}
      </View>

      {/* ── Video info ── */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>{videoTitle}</Text>
        <View style={styles.infoMeta}>
          <View style={styles.infoMetaItem}>
            <Ionicons name="time-outline" size={15} color="#9CA3AF" />
            <Text style={styles.infoMetaText}>{videoDuration}</Text>
          </View>
          <View style={styles.infoMetaDivider} />
          <View style={styles.infoMetaItem}>
            <Ionicons name="videocam-outline" size={15} color="#9CA3AF" />
            <Text style={styles.infoMetaText}>
              {isOfflinePlayback ? 'Offline in app' : isYouTube ? 'YouTube' : useNativePlayer ? 'In-app player' : 'External link'}
            </Text>
          </View>
        </View>

        {canDownloadOffline ? (
          <View style={styles.downloadSection}>
            {localDownload ? (
              <TouchableOpacity
                style={styles.removeDownloadBtn}
                onPress={handleRemoveDownload}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text style={styles.removeDownloadText}>Remove Download</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.downloadBtn,
                  (!isPremiumMember || downloadInProgress) && styles.downloadBtnDisabled,
                ]}
                onPress={handleDownloadPress}
                activeOpacity={0.85}
                disabled={!isPremiumMember || downloadInProgress}
              >
                {downloadInProgress ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.downloadBtnText}>
                  {downloadInProgress
                    ? `Downloading ${Math.round(downloadProgress * 100)}%`
                    : isPremiumMember
                      ? 'Download for Offline'
                      : 'Premium Download'}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.downloadHint}>
              {isPremiumMember
                ? 'Saved inside the app only. Downloaded videos will not appear in your phone gallery.'
                : 'Offline download is available only for users with an active membership.'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Linked Assignments ── */}
      {assignments && assignments.length > 0 && (
        <View style={styles.assignmentSection}>
          <Text style={styles.assignmentHeading}>Linked Assignments</Text>
          {assignments.map((assignment) => (
            <TouchableOpacity
              key={assignment?._id}
              style={styles.assignmentBtn}
              onPress={() => assignment && handleAssignmentPress(assignment)}
              activeOpacity={0.8}
            >
              <View style={[styles.assignmentIcon, { backgroundColor: courseColor + '20' }]}>
                <Ionicons name="help-circle" size={20} color={courseColor} />
              </View>
              <View style={styles.assignmentInfo}>
                <Text style={styles.assignmentTitle}>{assignment?.title || 'Practice Quiz'}</Text>
                <Text style={styles.assignmentMeta}>{assignment?.questions?.length || 0} Questions</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#475569" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Mark complete ── */}
      {token && (
        <View style={styles.actionSection}>
          <TouchableOpacity
            onPress={markComplete}
            style={[
              styles.markBtn,
              marked
                ? { backgroundColor: '#10B981' }
                : { backgroundColor: courseColor },
            ]}
            activeOpacity={0.85}
            disabled={marked}
          >
            <Ionicons
              name={marked ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.markBtnText}>
              {marked ? 'Completed ✓' : 'Mark as Complete'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const VIDEO_HEIGHT = width * 0.5625; // 16:9

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerCourse: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerVideo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },

  /* Video */
  videoArea: {
    width: '100%',
    backgroundColor: '#000',
  },
  videoBox: {
    width: '100%',
    height: VIDEO_HEIGHT,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    color: '#FFF',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  dismissBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  dismissText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  /* External player */
  extPlayerBg: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: '#111827',
  },
  extPlayBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extPlayHint: {
    position: 'absolute',
    bottom: 16,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },

  /* Info */
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.1)',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 10,
    lineHeight: 24,
  },
  infoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoMetaText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  infoMetaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
    marginHorizontal: 10,
  },
  downloadSection: {
    marginTop: 18,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  downloadBtnDisabled: {
    backgroundColor: '#64748B',
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  removeDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  removeDownloadText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  downloadHint: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },

  /* Assignments */
  assignmentSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.1)',
  },
  assignmentHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  assignmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  assignmentIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  assignmentMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },

  /* Action */
  actionSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  markBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
