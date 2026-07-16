import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_KEY = 'offline_podcast_downloads_v1';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory}offline-podcasts/`;

export interface OfflinePodcastItem {
    podcastId: string;
    podcastTitle: string;
    podcastHost: string;
    podcastCategory: string;
    podcastDuration: string;
    thumbnailUrl: string;
    remoteUrl: string;
    localUri: string;
    downloadedAt: string;
}

interface OfflinePodcastState {
    downloads: OfflinePodcastItem[];
    progressByPodcastId: Record<string, number>;
    activeDownloads: Record<string, boolean>;
    hydrated: boolean;

    hydrate: () => Promise<void>;
    getDownload: (podcastId: string) => OfflinePodcastItem | undefined;
    isDownloaded: (podcastId: string) => boolean;
    downloadPodcast: (item: Omit<OfflinePodcastItem, 'localUri' | 'downloadedAt'>) => Promise<{ success: boolean; message?: string }>;
    removeDownload: (podcastId: string) => Promise<boolean>;
}

function sanitizeFilePart(value: string): string {
    return value.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60);
}

async function persistDownloads(downloads: OfflinePodcastItem[]) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(downloads));
}

async function ensureDownloadDir() {
    const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
    }
}

export const useOfflinePodcastStore = create<OfflinePodcastState>((set, get) => ({
    downloads: [],
    progressByPodcastId: {},
    activeDownloads: {},
    hydrated: false,

    hydrate: async () => {
        if (get().hydrated) return;

        try {
            await ensureDownloadDir();
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            const parsed: OfflinePodcastItem[] = raw ? JSON.parse(raw) : [];

            const validDownloads: OfflinePodcastItem[] = [];
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

    getDownload: (podcastId) => get().downloads.find((item) => item.podcastId === podcastId),

    isDownloaded: (podcastId) => get().downloads.some((item) => item.podcastId === podcastId),

    downloadPodcast: async (item) => {
        const existing = get().getDownload(item.podcastId);
        if (existing) {
            return { success: true, message: 'Already downloaded' };
        }

        if (get().activeDownloads[item.podcastId]) {
            return { success: false, message: 'Download already in progress' };
        }

        try {
            await ensureDownloadDir();

            const filename = `${sanitizeFilePart(item.podcastId)}.mp3`;
            const localUri = `${DOWNLOAD_DIR}${filename}`;

            set((state) => ({
                activeDownloads: { ...state.activeDownloads, [item.podcastId]: true },
                progressByPodcastId: { ...state.progressByPodcastId, [item.podcastId]: 0 },
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
                        progressByPodcastId: {
                            ...state.progressByPodcastId,
                            [item.podcastId]: ratio,
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
                ...get().downloads.filter((download) => download.podcastId !== item.podcastId),
            ];

            await persistDownloads(downloads);

            set((state) => {
                const nextProgress = { ...state.progressByPodcastId };
                const nextActive = { ...state.activeDownloads };
                delete nextProgress[item.podcastId];
                delete nextActive[item.podcastId];

                return {
                    downloads,
                    progressByPodcastId: nextProgress,
                    activeDownloads: nextActive,
                };
            });

            return { success: true };
        } catch (error: any) {
            set((state) => {
                const nextProgress = { ...state.progressByPodcastId };
                const nextActive = { ...state.activeDownloads };
                delete nextProgress[item.podcastId];
                delete nextActive[item.podcastId];

                return {
                    progressByPodcastId: nextProgress,
                    activeDownloads: nextActive,
                };
            });
            return { success: false, message: error?.message || 'Download failed' };
        }
    },

    removeDownload: async (podcastId) => {
        const target = get().getDownload(podcastId);
        if (!target) return true;

        try {
            const info = await FileSystem.getInfoAsync(target.localUri);
            if (info.exists) {
                await FileSystem.deleteAsync(target.localUri, { idempotent: true });
            }

            const downloads = get().downloads.filter((item) => item.podcastId !== podcastId);
            await persistDownloads(downloads);
            set({ downloads });
            return true;
        } catch (error) {
            return false;
        }
    },
}));
