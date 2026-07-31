import { create } from 'zustand';
import apiClient from '../utils/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'recs_cache';
const CACHE_TTL = 30 * 60 * 1000;

interface Recommendation {
    _id: string;
    title: string;
    description: string;
    shortDescription: string;
    category: string;
    thumbnailUrl: string;
    color: string;
    duration: string;
    totalVideos: number;
    whyThisFits: string;
    recommendationScore?: number;
}

interface RecommendationState {
    recommendations: Recommendation[];
    loading: boolean;
    error: string | null;
    enrolledCourseIds: Set<string>;

    fetchRecommendations: (force?: boolean) => Promise<void>;
    getCached: () => Recommendation[];
    markEnrolled: (courseId: string) => void;
}

export const useRecommendationStore = create<RecommendationState>((set, get) => ({
    recommendations: [],
    loading: false,
    error: null,
    enrolledCourseIds: new Set(),

    fetchRecommendations: async (force = false) => {
        if (!force) {
            try {
                const cached = await AsyncStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_TTL && Array.isArray(data) && data.length > 0) {
                        set({ recommendations: data, loading: false });
                        return;
                    }
                }
            } catch (_) {}
        }

        set({ loading: true, error: null });
        try {
            const response = await apiClient.get('/api/assessment/recommendations');
            if (response.data?.success && Array.isArray(response.data?.recommendations)) {
                const recs = response.data.recommendations;
                set({ recommendations: recs, loading: false });
                try {
                    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: recs, timestamp: Date.now() }));
                } catch (_) {}
            } else {
                set({ recommendations: [], loading: false });
            }
        } catch (error: any) {
            set({
                error: error.response?.data?.message || 'Failed to fetch recommendations',
                loading: false,
            });
        }
    },

    getCached: () => get().recommendations,

    markEnrolled: (courseId: string) => {
        const ids = new Set(get().enrolledCourseIds);
        ids.add(courseId);
        set({ enrolledCourseIds: ids });
    },
}));
