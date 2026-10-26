import { create } from 'zustand';
import { AppState, Platform } from 'react-native';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import apiClient from '../utils/apiClient';
import { API_URL } from '../config/api';

export interface PodcastTrack {
    id: string;
    title: string;
    host: string;
    thumbnailUrl: string;
    audioUrl: string;
    duration: string;
    category: string;
    courseId?: string;
    audioId?: string;
}

let lastAudioReportAt = 0;
let statusSubscription: { remove: () => void } | null = null;

interface AudioPlayerState {
    currentTrack: PodcastTrack | null;
    isPlaying: boolean;
    isLoaded: boolean;
    isBuffering: boolean;
    playbackPosition: number;
    playbackDuration: number;
    sound: AudioPlayer | null;

    loadAndPlay: (track: PodcastTrack) => Promise<void>;
    togglePlayPause: () => Promise<void>;
    seek: (ms: number) => Promise<void>;
    stop: () => Promise<void>;
    syncPlaybackState: () => void;
}

async function configureAudioMode() {
    await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
    });
}

const applyStatus = (track: PodcastTrack | null, status: AudioStatus) => {
    if (!status.isLoaded) return;

    useAudioPlayerStore.setState({
        isPlaying: status.playing,
        isBuffering: status.isBuffering,
        playbackPosition: Math.round((status.currentTime || 0) * 1000),
        playbackDuration: Math.round((status.duration || 0) * 1000),
        isLoaded: true,
    });

    if (track?.courseId && track?.audioId && status.duration > 0) {
        const now = Date.now();
        if (now - lastAudioReportAt >= 10000 || !status.playing) {
            lastAudioReportAt = now;
            apiClient.patch(
                `${API_URL}/enrollments/course/${track.courseId}/audio/${track.audioId}/position`,
                {
                    positionSeconds: Math.floor(status.currentTime || 0),
                    durationSeconds: Math.floor(status.duration),
                }
            ).catch(() => {});
        }
    }
};

const lockScreenMetadata = (track: PodcastTrack) => ({
    title: track.title,
    artist: track.host,
    albumTitle: 'Paramsukh Online Gurukul',
    ...(track.thumbnailUrl?.startsWith('http') ? { artworkUrl: track.thumbnailUrl } : {}),
});

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

        statusSubscription?.remove();
        statusSubscription = null;

        if (currentSound) {
            try {
                currentSound.clearLockScreenControls();
                currentSound.remove();
            } catch {
                // Player may already be released.
            }
        }

        await configureAudioMode();

        const player = createAudioPlayer(
            { uri: track.audioUrl },
            { updateInterval: 500 }
        );

        statusSubscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
            applyStatus(track, status);
        });

        player.setActiveForLockScreen(
            true,
            lockScreenMetadata(track),
            { showSeekBackward: true, showSeekForward: true }
        );
        player.play();

        set({
            currentTrack: track,
            sound: player,
            isPlaying: true,
            isLoaded: false,
            isBuffering: true,
            playbackPosition: 0,
            playbackDuration: 0,
        });
    },

    togglePlayPause: async () => {
        const { sound, isPlaying } = get();
        if (!sound) return;

        if (sound.playing || isPlaying) {
            sound.pause();
            set({ isPlaying: false });
        } else {
            sound.play();
            set({ isPlaying: true });
        }
    },

    seek: async (ms: number) => {
        const { sound } = get();
        if (!sound) return;
        await sound.seekTo(ms / 1000);
    },

    stop: async () => {
        const { sound } = get();

        statusSubscription?.remove();
        statusSubscription = null;

        if (sound) {
            try {
                sound.clearLockScreenControls();
                sound.remove();
            } catch {
                // Player may already be released.
            }
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

    syncPlaybackState: () => {
        const { sound } = get();
        if (!sound?.isLoaded) return;
        applyStatus(get().currentTrack, sound.currentStatus);
    },
}));

if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            useAudioPlayerStore.getState().syncPlaybackState();
        }
    });
}
