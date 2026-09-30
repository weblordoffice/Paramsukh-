import { create } from 'zustand';
import apiClient from '../utils/apiClient';
import { API_URL } from '../config/api';
interface CounselorType {
    id: string; // Map from _id
    _id?: string;
    title: string;
    counselorName?: string;
    icon: string;
    color: string;
    bgColor: string;
    description: string;
    duration: string;
    isFree?: boolean;
    price?: number;
}

export interface UserBooking {
    _id: string;
    bookingTitle: string;
    counselorName: string;
    counselorType?: string;
    bookingType?: string;
    bookingDate: string;
    bookingTime: string;
    status: string;
    meetingLink?: string;
    meetingId?: string;
    meetingPassword?: string;
    meetingPlatform?: string;
    duration?: number;
    userNotes?: string;
    amount?: number;
    paymentStatus?: string;
    isFree?: boolean;
    rescheduleRequest?: {
        status: 'none' | 'pending' | 'approved' | 'denied';
        requestedBy: 'none' | 'user' | 'admin';
        requestedNewDate?: string;
        requestedNewTime?: string;
        reason?: string;
    };
}

interface CounselingState {
    counselingTypes: CounselorType[];
    isLoading: boolean;
    isLoadingSlots: boolean;
    isLoadingBookings: boolean;
    error: string | null;
    errorBookings: string | null;
    fetchCounselingTypes: () => Promise<void>;
    checkAvailability: (date: string, counselorType: string) => Promise<string[]>;
    bookSession: (bookingData: any) => Promise<{ success: boolean; message?: string; bookingId?: string }>;
    createBookingOrder: (bookingId: string, amount: number) => Promise<{ success: boolean; data?: { razorpay: { orderId: string; amount: number; currency: string; keyId: string } }; message?: string }>;
    createBookingPaymentLink: (bookingId: string) => Promise<{ success: boolean; url?: string; paymentLinkId?: string; expiresAt?: string; message?: string }>;
    confirmBookingPaymentLink: (paymentLinkId: string, bookingId: string) => Promise<{ success: boolean; message?: string }>;
    verifyCounselingPayment: (bookingId: string, paymentData: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => Promise<{ success: boolean; message?: string }>;
    fetchMyBookings: (status?: string) => Promise<UserBooking[]>;
    fetchBookingDetails: (bookingId: string) => Promise<UserBooking | null>;
    cancelBooking: (bookingId: string, reason?: string) => Promise<{ success: boolean; message?: string }>;
    rescheduleBooking: (bookingId: string, newDate: string, newTime: string, reason?: string) => Promise<{ success: boolean; message?: string }>;
    requestReschedule: (bookingId: string, newDate: string, newTime: string, reason?: string) => Promise<{ success: boolean; message?: string }>;
    respondToReschedule: (bookingId: string, action: 'approve' | 'deny', responseNote?: string) => Promise<{ success: boolean; message?: string }>;
    submitFeedback: (bookingId: string, feedback: { rating: number; comment?: string }) => Promise<{ success: boolean; message?: string }>;
    abortBookingsRequest: () => void;
}

let activeBookingsRequestId = 0;

export const useCounselingStore = create<CounselingState>((set) => ({
    counselingTypes: [],
    isLoading: false,
    isLoadingSlots: false,
    isLoadingBookings: false,
    error: null,
    errorBookings: null,

    fetchCounselingTypes: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.get('/counseling/services');
            if (response.data && response.data.success) {
                const types = response.data?.data?.services?.map((s: any) => ({
                    id: s._id,
                    _id: s._id,
                    title: s.title,
                    counselorName: s.counselorName || 'Expert Counselor',
                    description: s.description,
                    icon: s.icon || 'help-buoy',
                    color: s.color || '#3B82F6',
                    bgColor: s.bgColor || '#EFF6FF',
                    duration: s.duration, // Ensure string or format it
                    price: s.price,
                    isFree: s.isFree,
                })) ?? [];
                set({ counselingTypes: types, isLoading: false });
            } else {
                set({ counselingTypes: [], isLoading: false });
            }
        } catch (error: any) {
            set({ isLoading: false, error: 'Failed to load counseling types' });
        }
    },

    checkAvailability: async (date: string, counselorType: string) => {
        set({ isLoadingSlots: true, error: null });
        try {
            const response = await apiClient.get(`${API_URL}/counseling/availability`, {
                params: { date, counselorType }
            });
            set({ isLoadingSlots: false });
            return response.data?.data?.availableSlots || [];
        } catch (error: any) {
            set({ isLoadingSlots: false, error: 'Failed to check availability' });
            return [];
        }
    },

    bookSession: async (bookingData: any) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.post(`${API_URL}/counseling/book`, bookingData);
            set({ isLoading: false });
            if (response.data?.success) {
                const bookingId = response.data?.data?.booking?._id;
                return { success: true, message: 'Booking created', bookingId };
            }
            return { success: false, message: response.data?.message || 'Booking failed' };
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Booking failed';
            set({ isLoading: false, error: msg });
            return { success: false, message: msg };
        }
    },

    createBookingOrder: async (bookingId: string, amount: number) => {
        try {
            const response = await apiClient.post(
                `${API_URL}/payments/create-booking-order`,
                { bookingId, amount }
            );
            if (response.data?.success && response.data?.data) {
                const d = response.data?.data;
                return {
                    success: true,
                    data: {
                        razorpay: {
                            orderId: d.orderId,
                            amount: d.amount,
                            currency: d.currency || 'INR',
                            keyId: d.keyId
                        }
                    }
                };
            }
            return { success: false, message: response.data?.message || 'Failed to create payment order' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Failed to create payment order' };
        }
    },

    createBookingPaymentLink: async (bookingId: string) => {
        try {
            const response = await apiClient.post(
                `${API_URL}/payments/booking-link`,
                { bookingId }
            );
            if (response.data?.success && response.data?.data) {
                return {
                    success: true,
                    url: response.data?.data?.url,
                    paymentLinkId: response.data?.data?.paymentLinkId,
                    expiresAt: response.data?.data?.expiresAt,
                };
            }
            return { success: false, message: response.data?.message || 'Failed to create payment link' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Failed to create payment link' };
        }
    },

    confirmBookingPaymentLink: async (paymentLinkId: string, bookingId: string) => {
        try {
            const response = await apiClient.post(
                `${API_URL}/payments/booking-link/confirm`,
                { paymentLinkId, bookingId }
            );
            if (response.data?.success) return { success: true, message: response.data?.message };
            return { success: false, message: response.data?.message || 'Payment confirmation failed' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Payment confirmation failed' };
        }
    },

    verifyCounselingPayment: async (bookingId: string, paymentData: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        try {
            const response = await apiClient.post(
                `${API_URL}/counseling/${bookingId}/payment`,
                paymentData
            );
            if (response.data?.success) return { success: true, message: response.data?.message };
            return { success: false, message: response.data?.message || 'Payment verification failed' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Payment verification failed' };
        }
    },

    fetchMyBookings: async (status?: string) => {
        const requestId = ++activeBookingsRequestId;
        set({ isLoadingBookings: true, errorBookings: null });
        try {
            const response = await apiClient.get(`${API_URL}/counseling/my-bookings`, {
                params: status ? { status } : {},
                signal: AbortSignal.timeout(10000)
            });
            if (requestId !== activeBookingsRequestId) {
                return [];
            }
            set({ isLoadingBookings: false });
            return response.data?.data?.bookings || [];
        } catch (error: any) {
            if (requestId !== activeBookingsRequestId) {
                return [];
            }
            set({ isLoadingBookings: false, errorBookings: error?.message || 'Failed to load bookings' });
            return [];
        }
    },

    abortBookingsRequest: () => {
        activeBookingsRequestId++;
    },

    fetchBookingDetails: async (bookingId: string) => {
        try {
            const response = await apiClient.get(`${API_URL}/counseling/${bookingId}`);
            if (response.data?.success) {
                return response.data?.data?.booking || null;
            }
            return null;
        } catch (error: any) {
            return null;
        }
    },

    cancelBooking: async (bookingId: string, reason?: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.patch(`${API_URL}/counseling/${bookingId}/cancel`, { reason });
            set({ isLoading: false });
            if (response.data?.success) {
                return { success: true, message: response.data?.message };
            }
            return { success: false, message: response.data?.message || 'Cancellation failed' };
        } catch (error: any) {
            set({ isLoading: false, error: error.response?.data?.message || 'Cancellation failed' });
            return { success: false, message: error.response?.data?.message || 'Cancellation failed' };
        }
    },

    rescheduleBooking: async (bookingId: string, newDate: string, newTime: string, reason?: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.patch(`${API_URL}/counseling/${bookingId}/reschedule`, {
                newDate,
                newTime,
                reason
            });
            set({ isLoading: false });
            if (response.data?.success) {
                return { success: true, message: response.data?.message };
            }
            return { success: false, message: response.data?.message || 'Reschedule failed' };
        } catch (error: any) {
            set({ isLoading: false, error: error.response?.data?.message || 'Reschedule failed' });
            return { success: false, message: error.response?.data?.message || 'Reschedule failed' };
        }
    },

    requestReschedule: async (bookingId: string, newDate: string, newTime: string, reason?: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.post(`${API_URL}/counseling/${bookingId}/reschedule-request`, {
                newDate,
                newTime,
                reason
            });
            set({ isLoading: false });
            if (response.data?.success) {
                return { success: true, message: response.data?.message };
            }
            return { success: false, message: response.data?.message || 'Failed to submit reschedule request' };
        } catch (error: any) {
            set({ isLoading: false, error: error.response?.data?.message || 'Failed to submit reschedule request' });
            return { success: false, message: error.response?.data?.message || 'Failed to submit reschedule request' };
        }
    },

    respondToReschedule: async (bookingId: string, action: 'approve' | 'deny', responseNote?: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.post(`${API_URL}/counseling/${bookingId}/reschedule-respond`, {
                action,
                responseNote
            });
            set({ isLoading: false });
            if (response.data?.success) {
                return { success: true, message: response.data?.message };
            }
            return { success: false, message: response.data?.message || 'Failed to respond to reschedule request' };
        } catch (error: any) {
            set({ isLoading: false, error: error.response?.data?.message || 'Failed to respond to reschedule request' });
            return { success: false, message: error.response?.data?.message || 'Failed to respond to reschedule request' };
        }
    },

    submitFeedback: async (bookingId: string, feedback: { rating: number; comment?: string }) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.post(`${API_URL}/counseling/${bookingId}/feedback`, feedback);
            set({ isLoading: false });
            if (response.data?.success) {
                return { success: true, message: response.data?.message };
            }
            return { success: false, message: response.data?.message || 'Feedback submission failed' };
        } catch (error: any) {
            set({ isLoading: false, error: error.response?.data?.message || 'Feedback submission failed' });
            return { success: false, message: error.response?.data?.message || 'Feedback submission failed' };
        }
    }
}));
