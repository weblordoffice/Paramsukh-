import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuthStore } from './authStore';

export interface Question {
    _id: string;
    questionText: string;
    type: 'mcq' | 'input';
    options: string[];
    correctAnswer: string;
    explanation?: string;
}

export interface Assignment {
    _id: string;
    title: string;
    description?: string;
    questions: Question[];
    order: number;
    isStandalone: boolean;
}

export interface Video {
    _id: string;
    title: string;
    description?: string;
    duration: string; // "15:30"
    videoUrl: string;
    thumbnailUrl?: string;
    order: number;
    isFree: boolean;
    assignments?: Assignment[];
}

export interface Pdf {
    _id: string;
    title: string;
    description?: string;
    pdfUrl: string;
    thumbnailUrl?: string;
    order: number;
    isFree: boolean;
}

export interface LiveSession {
    _id: string;
    title: string;
    description?: string;
    scheduledAt: string;
    durationInMinutes: number;
    meetingPlatform: string;
    meetingLink: string;
    status: 'scheduled' | 'completed' | 'cancelled';
}

export interface Course {
    _id: string;
    title: string;
    description: string;
    shortDescription?: string;
    icon: string;
    color: string;
    thumbnailUrl?: string;
    bannerUrl?: string;
    duration: string; // "6 weeks"
    category: string;
    tags: string[];
    status: 'draft' | 'published' | 'archived';
    includedInPlans: string[];

    // Content Statistics
    totalVideos: number;
    totalPdfs: number;

    // Content Arrays (populated when fetching detail)
    videos?: Video[];
    pdfs?: Pdf[];
    liveSessions?: LiveSession[];
    assignments?: Assignment[];

    createdAt: string;
}

export interface EnrollmentProgress {
    progress: number;
    completedVideos: string[];
    completedPdfs: string[];
    currentVideoId: string | null;
    isCompleted: boolean;
    lastAccessedAt: string;
}

interface CourseState {
    courses: Course[];
    currentCourse: Course | null;
    enrollmentProgress: EnrollmentProgress | null;
    isLoading: boolean;
    error: string | null;

    fetchCourses: () => Promise<void>;
    fetchCourseById: (id: string) => Promise<void>;
    fetchCourseBySlug: (slug: string) => Promise<void>;
    fetchEnrollmentProgress: (courseId: string) => Promise<void>;
    markVideoComplete: (courseId: string, videoId: string) => Promise<boolean>;
    markPdfComplete: (courseId: string, pdfId: string) => Promise<boolean>;
    clearCurrentCourse: () => void;
}

export const useCourseStore = create<CourseState>((set) => ({
    courses: [],
    currentCourse: null,
    enrollmentProgress: null,
    isLoading: false,
    error: null,

    fetchCourses: async () => {
        set({ isLoading: true, error: null });
        try {
            const token = useAuthStore.getState().token;
            // Optionally include token if available, but don't fail if not
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const response = await axios.get(`${API_URL}/courses/all`, { headers });

            if (response.data && response.data.success) {
                const publishedCourses = (response.data.courses || []).filter(
                    (course: Course) => course?.status === 'published'
                );
                set({ courses: publishedCourses, isLoading: false });
            } else {
                set({ courses: [], isLoading: false });
            }
        } catch (error: any) {
            // Silently fail - don't show errors to user if courses aren't available
            set({ isLoading: false, courses: [], error: null });
        }
    },

    fetchCourseById: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            const token = useAuthStore.getState().token;
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const response = await axios.get(`${API_URL}/courses/${id}`, { headers });
            if (response.data.success) {
                set({ currentCourse: response.data.course, isLoading: false });
            } else {
                set({ isLoading: false, error: response.data.message });
            }
        } catch (error: any) {
            set({ isLoading: false, error: error.message || 'Failed to fetch course details' });
        }
    },

    fetchCourseBySlug: async (slug: string) => {
        set({ isLoading: true, error: null });
        try {
            const token = useAuthStore.getState().token;
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const response = await axios.get(`${API_URL}/courses/slug/${slug}`, { headers });
            if (response.data.success) {
                set({ currentCourse: response.data.course, isLoading: false });
            } else {
                set({ isLoading: false, error: response.data.message || 'Failed to fetch course' });
            }
        } catch (error: any) {
            set({ isLoading: false, error: 'Failed to fetch course' });
        }
    },

    fetchEnrollmentProgress: async (courseId: string) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return;

            const response = await axios.get(`${API_URL}/courses/${courseId}/progress`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                set({ enrollmentProgress: response.data.data });
            }
        } catch (error: any) {
            // 404 = user is not enrolled yet — this is expected, not a real error
        }
    },

    markVideoComplete: async (courseId: string, videoId: string) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return false;

            const response = await axios.post(`${API_URL}/courses/${courseId}/progress/video/${videoId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                set({ enrollmentProgress: response.data.data });
                return true;
            }
            return false;
        } catch (error: any) {
            // 404 = user not enrolled — expected, don't log as error
            return false;
        }
    },

    markPdfComplete: async (courseId: string, pdfId: string) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return false;

            const response = await axios.post(`${API_URL}/courses/${courseId}/progress/pdf/${pdfId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                set({ enrollmentProgress: response.data.data });
                return true;
            }
            return false;
        } catch (error: any) {
            return false;
        }
    },

    clearCurrentCourse: () => set({ currentCourse: null, enrollmentProgress: null })
}));

