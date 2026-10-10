import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_KEY = 'offline_video_downloads_v1';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory}offline-videos/`;

export interface OfflineVideoItem {
  videoId: string;
  courseId: string;
  courseTitle: string;
  courseColor: string;
  videoTitle: string;
  videoDuration: string;
  remoteUrl: string;
  localUri: string;
  downloadedAt: string;
}

interface OfflineVideoState {
  downloads: OfflineVideoItem[];
  progressByVideoId: Record<string, number>;
  activeDownloads: Record<string, boolean>;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  getDownload: (videoId: string) => OfflineVideoItem | undefined;
  isDownloaded: (videoId: string) => boolean;
  downloadVideo: (item: Omit<OfflineVideoItem, 'localUri' | 'downloadedAt'>) => Promise<{ success: boolean; message?: string }>;
  removeDownload: (videoId: string) => Promise<boolean>;
  reset: () => Promise<void>;
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60);
}

// `/video/upload` and `.mp4` produce a single progressive file that can be saved
// and played offline. HLS playlists (`.m3u8`) are only a text manifest pointing at
// segments, so saving just the manifest yields an unplayable file.
export function isDownloadableVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const u = url.toLowerCase();
  if (u.includes('.m3u8')) return false;
  return (
    u.includes('cloudinary.com') ||
    u.includes('.mp4') ||
    u.includes('.webm') ||
    u.includes('video/upload')
  );
}

function base64ToBytes(base64: string): number[] {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = chars.indexOf(clean[i]);
    const c1 = chars.indexOf(clean[i + 1]);
    const c2 = chars.indexOf(clean[i + 2]);
    const c3 = chars.indexOf(clean[i + 3]);
    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 >= 0) bytes.push(((c2 & 3) << 6) | c3);
  }
  return bytes;
}

/**
 * Verifies that a downloaded file is an actual media container rather than an
 * HTML/JSON error page or an HLS manifest. Used to avoid persisting a corrupt
 * "download" that later makes ExoPlayer throw
 * "None of the available extractors could read the stream".
 */
export async function isPlayableVideoFile(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return false;
    // Real videos are large; error pages and m3u8 manifests are tiny.
    if (info.size < 64 * 1024) return false;

    const head = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 32,
      position: 0,
    });
    const bytes = base64ToBytes(head);
    if (bytes.length < 8) return false;

    const ascii = bytes.map((c) => String.fromCharCode(c)).join('');
    // Reject text payloads (HTML error pages, JSON responses, HLS manifests).
    if (/^\s*(<|#EXTM3U|\{)/i.test(ascii)) return false;

    // ISO BMFF (mp4 / mov / m4v) — `ftyp` box.
    if (ascii.includes('ftyp')) return true;
    // Matroska / WebM.
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true;
    // MPEG-TS.
    if (bytes[0] === 0x47) return true;
    // FLV.
    if (bytes[0] === 0x46 && bytes[1] === 0x4c && bytes[2] === 0x56) return true;
    // Ogg.
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return true;
    // AVI / WAV (RIFF).
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
    // ASF / WMV.
    if (bytes[0] === 0x30 && bytes[1] === 0x26 && bytes[2] === 0xb2 && bytes[3] === 0x75) return true;

    return false;
  } catch {
    return false;
  }
}

async function persistDownloads(downloads: OfflineVideoItem[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(downloads));
}

async function ensureDownloadDir() {
  const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  }
}

export const useOfflineVideoStore = create<OfflineVideoState>((set, get) => ({
  downloads: [],
  progressByVideoId: {},
  activeDownloads: {},
  hydrated: false,

  hydrate: async () => {
    try {
      await ensureDownloadDir();
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: OfflineVideoItem[] = raw ? JSON.parse(raw) : [];

      const validDownloads: OfflineVideoItem[] = [];
      for (const item of parsed) {
        const playable = await isPlayableVideoFile(item.localUri);
        if (playable) {
          validDownloads.push(item);
        } else {
          // Remove corrupt/partial files so we don't try to play them later.
          await FileSystem.deleteAsync(item.localUri, { idempotent: true }).catch(() => {});
        }
      }

      if (validDownloads.length !== parsed.length) {
        await persistDownloads(validDownloads);
      }

      set({ downloads: validDownloads, hydrated: true });
    } catch (error) {
      set({ downloads: [], hydrated: true });
    }
  },

  getDownload: (videoId) => get().downloads.find((item) => item.videoId === videoId),

  isDownloaded: (videoId) => get().downloads.some((item) => item.videoId === videoId),

  downloadVideo: async (item) => {
    const existing = get().getDownload(item.videoId);
    if (existing) {
      return { success: true, message: 'Already downloaded' };
    }

    if (get().activeDownloads[item.videoId]) {
      return { success: false, message: 'Download already in progress' };
    }

    try {
      await ensureDownloadDir();

      const filename = `${sanitizeFilePart(item.courseId)}-${sanitizeFilePart(item.videoId)}.mp4`;
      const localUri = `${DOWNLOAD_DIR}${filename}`;

      set((state) => ({
        activeDownloads: { ...state.activeDownloads, [item.videoId]: true },
        progressByVideoId: { ...state.progressByVideoId, [item.videoId]: 0 },
      }));

      const resumable = FileSystem.createDownloadResumable(
        item.remoteUrl,
        localUri,
        {},
        (progress) => {
          const total = progress.totalBytesExpectedToWrite || 0;
          const written = progress.totalBytesWritten || 0;
          const ratio = total > 0 ? written / total : 0;
          set((state) => ({
            progressByVideoId: {
              ...state.progressByVideoId,
              [item.videoId]: ratio,
            },
          }));
        }
      );

      const result = await resumable.downloadAsync();
      if (!result?.uri) {
        throw new Error('Download failed');
      }

      const playable = await isPlayableVideoFile(result.uri);
      if (!playable) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
        throw new Error(
          'This video source cannot be saved for offline viewing (it may be a live stream or protected link).'
        );
      }

      const downloads = [
        {
          ...item,
          localUri: result.uri,
          downloadedAt: new Date().toISOString(),
        },
        ...get().downloads.filter((download) => download.videoId !== item.videoId),
      ];

      await persistDownloads(downloads);

      set((state) => {
        const nextProgress = { ...state.progressByVideoId };
        const nextActive = { ...state.activeDownloads };
        delete nextProgress[item.videoId];
        delete nextActive[item.videoId];

        return {
          downloads,
          progressByVideoId: nextProgress,
          activeDownloads: nextActive,
        };
      });

      return { success: true };
    } catch (error: any) {
      set((state) => {
        const nextProgress = { ...state.progressByVideoId };
        const nextActive = { ...state.activeDownloads };
        delete nextProgress[item.videoId];
        delete nextActive[item.videoId];

        return {
          progressByVideoId: nextProgress,
          activeDownloads: nextActive,
        };
      });
      return { success: false, message: error?.message || 'Download failed' };
    }
  },

  removeDownload: async (videoId) => {
    const target = get().getDownload(videoId);
    if (!target) return true;

    try {
      const info = await FileSystem.getInfoAsync(target.localUri);
      if (info.exists) {
        await FileSystem.deleteAsync(target.localUri, { idempotent: true });
      }

      const downloads = get().downloads.filter((item) => item.videoId !== videoId);
      await persistDownloads(downloads);
      set({ downloads });
      return true;
    } catch (error) {
      return false;
    }
  },

  reset: async () => {
    set({ downloads: [], progressByVideoId: {}, activeDownloads: {}, hydrated: false });
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    await FileSystem.deleteAsync(DOWNLOAD_DIR, { idempotent: true }).catch(() => {});
  },
}));
