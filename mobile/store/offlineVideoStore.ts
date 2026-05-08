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
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60);
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
    if (get().hydrated) return;

    try {
      await ensureDownloadDir();
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: OfflineVideoItem[] = raw ? JSON.parse(raw) : [];

      const validDownloads: OfflineVideoItem[] = [];
      for (const item of parsed) {
        const info = await FileSystem.getInfoAsync(item.localUri);
        if (info.exists) {
          validDownloads.push(item);
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
}));
