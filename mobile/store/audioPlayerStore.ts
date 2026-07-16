import { create } from 'zustand';
import { Audio } from 'expo-av';
import type { AVPlaybackStatus } from 'expo-av';

export interface PodcastTrack {
    id: string;
    title: string;
    host: string;
    thumbnailUrl: string;
    audioUrl: string;
    duration: string;
    category: string;
}

interface AudioPlayerState {
    currentTrack: PodcastTrack | null;
    isPlaying: boolean;
    isLoaded: boolean;
    isBuffering: boolean;
    playbackPosition: number;
    playbackDuration: number;
    sound: Audio.Sound | null;

    loadAndPlay: (track: PodcastTrack) => Promise<void>;
    togglePlayPause: () => Promise<void>;
    seek: (ms: number) => Promise<void>;
    stop: () => Promise<void>;
    setSound: (sound: Audio.Sound | null) => void;
    updatePlaybackStatus: (status: AVPlaybackStatus) => void;
}

async function configureAudioMode() {
    await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
    });
}

export const useAudioPlayerStore = create<AudioPlayerState>((set, get) => ({
    currentTrack: null,
    isPlaying: false,
    isLoaded: false,
    isBuffering: false,
    playbackPosition: 0,
    playbackDuration: 0,
    sound: null,

    loadAndPlay: async (track: PodcastTrack) => {
        const { sound: currentSound } = get();

        if (currentSound) {
            await currentSound.unloadAsync().catch(() => {});
        }

        await configureAudioMode();

        const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: track.audioUrl },
            { shouldPlay: true, progressUpdateIntervalMillis: 500 },
            (status) => {
                if (status.isLoaded) {
                    set({
                        isPlaying: status.isPlaying,
                        isBuffering: status.isBuffering,
                        playbackPosition: status.positionMillis,
                        playbackDuration: status.durationMillis || 0,
                        isLoaded: true,
                    });
                }
            }
        );

        set({
            currentTrack: track,
            sound: newSound,
            isPlaying: true,
            isLoaded: true,
            isBuffering: false,
            playbackPosition: 0,
            playbackDuration: 0,
        });
    },

    togglePlayPause: async () => {
        const { sound, isPlaying } = get();
        if (!sound) return;

        if (isPlaying) {
            await sound.pauseAsync();
        } else {
            await sound.playAsync();
        }
    },

    seek: async (ms: number) => {
        const { sound } = get();
        if (!sound) return;

        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
            await sound.setPositionAsync(ms);
        }
    },

    stop: async () => {
        const { sound } = get();

        if (sound) {
            await sound.stopAsync().catch(() => {});
            await sound.unloadAsync().catch(() => {});
        }

        set({
            currentTrack: null,
            sound: null,
            isPlaying: false,
            isLoaded: false,
            isBuffering: false,
            playbackPosition: 0,
            playbackDuration: 0,
        });
    },

    setSound: (sound) => set({ sound }),

    updatePlaybackStatus: (status) => {
        if (status.isLoaded) {
            set({
                isPlaying: status.isPlaying,
                isBuffering: status.isBuffering,
                playbackPosition: status.positionMillis,
                playbackDuration: status.durationMillis || 0,
                isLoaded: true,
            });
        }
    },
}));
