import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../utils/apiClient';
import { API_URL } from '../config/api';

const BLOGS_CACHE_KEY = 'blogs_cache';
const CATEGORIES_CACHE_KEY = 'blog_categories_cache';

export interface Blog {
    _id: string;
    title: string;
    content: string;
    excerpt?: string;
    imageUrl?: string;
    author: string;
    category?: string;
    tags?: string[];
    readTime?: number;
    createdAt: string;
    updatedAt: string;
}

interface PaginatedResponse {
    success: boolean;
    count: number;
    total: number;
    page: number;
    totalPages: number;
    data: { blogs: Blog[] };
}

interface BlogState {
    blogs: Blog[];
    categories: string[];
    currentBlog: Blog | null;
    isLoading: boolean;
    isLoadingMore: boolean;
    error: string | null;
    page: number;
    totalPages: number;
    hasMore: boolean;
    selectedCategory: string;

    fetchBlogs: (reset?: boolean) => Promise<void>;
    fetchCategories: () => Promise<void>;
    fetchMoreBlogs: () => Promise<void>;
    fetchBlogById: (id: string) => Promise<void>;
    setCategory: (category: string) => void;
    clearCurrentBlog: () => void;
    getCachedBlogs: () => Promise<void>;
}

export const useBlogStore = create<BlogState>((set, get) => ({
    blogs: [],
    categories: ['All'],
    currentBlog: null,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    page: 1,
    totalPages: 1,
    hasMore: false,
    selectedCategory: 'All',

    fetchCategories: async () => {
        try {
            const response = await apiClient.get(`${API_URL}/blogs/categories`);
            if (response.data?.success) {
                const cats = response.data.data.categories || ['All'];
                set({ categories: cats });
                await AsyncStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(cats));
            }
        } catch {
            const cached = await AsyncStorage.getItem(CATEGORIES_CACHE_KEY);
            if (cached) set({ categories: JSON.parse(cached) });
        }
    },

    fetchBlogs: async (reset = true) => {
        const { selectedCategory } = get();
        if (reset) {
            set({ isLoading: true, error: null, page: 1, blogs: [] });
        } else {
            set({ isLoading: true, error: null });
        }

        try {
            const params: Record<string, string> = { page: '1', limit: '10' };
            if (selectedCategory !== 'All') params.category = selectedCategory;

            const response = await apiClient.get<PaginatedResponse>(`${API_URL}/blogs`, { params });

            if (response.data?.success) {
                const { page, totalPages, total, data: { blogs } } = response.data;
                set({
                    blogs,
                    page,
                    totalPages,
                    hasMore: page < totalPages,
                    isLoading: false,
                    error: null,
                });

                await AsyncStorage.setItem(BLOGS_CACHE_KEY, JSON.stringify({
                    blogs,
                    page,
                    totalPages,
                    total,
                    selectedCategory,
                    timestamp: Date.now(),
                }));
            } else {
                set({ blogs: [], isLoading: false });
            }
        } catch (error: any) {
            set({
                isLoading: false,
                error: error.message || 'Failed to fetch blogs',
            });
        }
    },

    fetchMoreBlogs: async () => {
        const { page, totalPages, hasMore, isLoadingMore, selectedCategory } = get();
        if (!hasMore || isLoadingMore || page >= totalPages) return;

        set({ isLoadingMore: true });

        try {
            const nextPage = page + 1;
            const params: Record<string, string> = { page: String(nextPage), limit: '10' };
            if (selectedCategory !== 'All') params.category = selectedCategory;

            const response = await apiClient.get<PaginatedResponse>(`${API_URL}/blogs`, { params });

            if (response.data?.success) {
                const { totalPages: tp, data: { blogs } } = response.data;
                set((state) => ({
                    blogs: [...state.blogs, ...blogs],
                    page: nextPage,
                    totalPages: tp,
                    hasMore: nextPage < tp,
                    isLoadingMore: false,
                }));
            } else {
                set({ isLoadingMore: false });
            }
        } catch {
            set({ isLoadingMore: false });
        }
    },

    fetchBlogById: async (id: string) => {
        set({ isLoading: true, error: null, currentBlog: null });
        try {
            const response = await apiClient.get(`${API_URL}/blogs/${id}`);
            if (response.data && response.data.success) {
                set({ currentBlog: response.data.data.blog, isLoading: false });
            } else {
                set({ isLoading: false, error: response.data?.message || 'Blog not found' });
            }
        } catch (error: any) {
            set({ isLoading: false, error: error.message || 'Failed to fetch blog details' });
        }
    },

    setCategory: (category: string) => {
        set({ selectedCategory: category });
    },

    clearCurrentBlog: () => set({ currentBlog: null }),

    getCachedBlogs: async () => {
        try {
            const cached = await AsyncStorage.getItem(BLOGS_CACHE_KEY);
            if (cached) {
                const { blogs, page, totalPages, selectedCategory: cachedCat } = JSON.parse(cached);
                set({
                    blogs,
                    page,
                    totalPages,
                    hasMore: page < totalPages,
                    selectedCategory: cachedCat || 'All',
                });
            }
        } catch {
            // ignore
        }
    },
}));
