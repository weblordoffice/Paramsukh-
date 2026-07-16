import { create } from 'zustand';
import apiClient from '../utils/apiClient';

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
    _score?: number;
}

interface RecommendationState {
    recommendations: Recommendation[];
    loading: boolean;
    error: string | null;

    fetchRecommendations: () => Promise<void>;
    getCached: () => Recommendation[];
}

export const useRecommendationStore = create<RecommendationState>((set, get) => ({
    recommendations: [],
    loading: false,
    error: null,

    fetchRecommendations: async () => {
        set({ loading: true, error: null });
        try {
            const response = await apiClient.get('/api/assessment/recommendations');
            if (response.data?.success && Array.isArray(response.data?.recommendations)) {
                set({ recommendations: response.data.recommendations, loading: false });
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
}));
