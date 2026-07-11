import { create } from 'zustand';
import apiClient from '../utils/apiClient';
import { API_URL } from '../config/api';

export interface Blog {
    _id: string;
    title: string;
    content: string;
    imageUrl?: string;
    author: string;
    createdAt: string;
    updatedAt: string;
}

interface BlogState {
    blogs: Blog[];
    currentBlog: Blog | null;
    isLoading: boolean;
    error: string | null;

    fetchBlogs: () => Promise<void>;
    fetchBlogById: (id: string) => Promise<void>;
    clearCurrentBlog: () => void;
}

export const useBlogStore = create<BlogState>((set) => ({
    blogs: [],
    currentBlog: null,
    isLoading: false,
    error: null,

    fetchBlogs: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.get(`${API_URL}/blogs`);
            if (response.data && response.data.success) {
                set({ blogs: response.data.data.blogs || [], isLoading: false });
            } else {
                set({ blogs: [], isLoading: false });
            }
        } catch (error: any) {
            set({ isLoading: false, blogs: [], error: error.message || 'Failed to fetch blogs' });
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

    clearCurrentBlog: () => set({ currentBlog: null })
}));
