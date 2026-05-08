import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../config/api';

interface ShopCategory {
    _id: string;
    name: string;
    slug: string;
    icon?: string;
}

interface ShopRating {
    average: number;
    count: number;
}

export interface Shop {
    _id: string;
    id: string; // purely for UI compatibility if needed
    name: string;
    category: string; // Adjusted to match UI for now, though backend might populate whole object
    categories: ShopCategory[];
    rating: ShopRating;
    image: string; // UI uses emoji/image, backend has logo/banner
    description: string;
    productsCount: number; // Might need to be calculated or fetched separately
}

interface ShopState {
    shops: Shop[];
    isLoading: boolean;
    error: string | null;
    fetchShops: (params?: any) => Promise<void>;
}

export const useShopStore = create<ShopState>((set) => ({
    shops: [],
    isLoading: false,
    error: null,

    fetchShops: async (params) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/shops`, { params });

            if (response.data && response.data.success) {
                // Transform backend data to match UI expectations where necessary
                const backendShops = response.data.data.shops || [];

                // Map backend shop structure to what the UI expects (if different)
                const formattedShops = backendShops.map((shop: any) => ({
                    ...shop,
                    id: shop._id,
                    // Fallback for UI fields if backend missing them
                    rating: shop.rating || { average: 0, count: 0 },
                    image: shop.logo || '🏪',
                    productsCount: shop.productsCount || 0, // Backend might not send this by default
                    category: shop.categories?.[0]?.name || 'General'
                }));

                set({ shops: formattedShops, isLoading: false });
            } else {
                set({ shops: [], isLoading: false, error: null });
            }
        } catch (error: any) {
            // Don't show error to user, show empty list
            set({ shops: [], isLoading: false, error: null });
        }
    }
}));
