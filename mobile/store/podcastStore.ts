import { create } from 'zustand';
import apiClient from '../utils/apiClient';

interface FavoritePodcast {
    podcast: {
        _id: string;
        title: string;
        host: string;
        duration: string;
        category: string;
        thumbnailUrl: string;
        accessType: string;
    };
    addedAt: string;
}

interface PodcastStoreState {
    favorites: FavoritePodcast[];
    favoriteIds: Set<string>;
    loadingFavorites: boolean;
    loadingToggles: Record<string, boolean>;

    fetchFavorites: () => Promise<void>;
    toggleFavorite: (podcastId: string) => Promise<{ favorited: boolean }>;
    isFavorited: (podcastId: string) => boolean;
}

export const usePodcastStore = create<PodcastStoreState>((set, get) => ({
    favorites: [],
    favoriteIds: new Set(),
    loadingFavorites: false,
    loadingToggles: {},

    fetchFavorites: async () => {
        set({ loadingFavorites: true });
        try {
            const response = await apiClient.get('/podcasts/favorites');
            if (response.data?.success) {
                const favorites: FavoritePodcast[] = response.data.data?.favorites || [];
                const favoriteIds = new Set(favorites.map((f) => f.podcast._id));
                set({ favorites, favoriteIds, loadingFavorites: false });
            } else {
                set({ loadingFavorites: false });
            }
        } catch (error) {
            set({ loadingFavorites: false });
        }
    },

    toggleFavorite: async (podcastId: string) => {
        set((state) => ({
            loadingToggles: { ...state.loadingToggles, [podcastId]: true },
        }));

        try {
            const response = await apiClient.post(`/podcasts/${podcastId}/favorite`);
            if (response.data?.success) {
                const { favorited } = response.data.data;
                const { favoriteIds } = get();
                const newIds = new Set(favoriteIds);

                if (favorited) {
                    newIds.add(podcastId);
                } else {
                    newIds.delete(podcastId);
                }

                set((state) => {
                    const { [podcastId]: _, ...rest } = state.loadingToggles;
                    return { favoriteIds: newIds, loadingToggles: rest };
                });

                return { favorited };
            }
        } catch (error) {
            set((state) => {
                const { [podcastId]: _, ...rest } = state.loadingToggles;
                return { loadingToggles: rest };
            });
        }

        return { favorited: false };
    },

    isFavorited: (podcastId: string) => get().favoriteIds.has(podcastId),
}));
