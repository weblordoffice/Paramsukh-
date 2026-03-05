import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuthStore } from './authStore';

interface CounselorType {
    id: string; // Map from _id
    _id?: string;
    title: string;
    icon: string;
    color: string;
    bgColor: string;
    description: string;
    duration: string;
    isFree?: boolean;
    price?: number;
}

interface CounselingState {
    counselingTypes: CounselorType[];
    isLoading: boolean;
    error: string | null;
    fetchCounselingTypes: () => Promise<void>;
    checkAvailability: (date: string, counselorType: string) => Promise<string[]>;
    bookSession: (bookingData: any) => Promise<{ success: boolean; message?: string; bookingId?: string }>;
    createBookingOrder: (bookingId: string, amount: number) => Promise<{ success: boolean; data?: { razorpay: { orderId: string; amount: number; currency: string; keyId: string } }; message?: string }>;
    verifyCounselingPayment: (bookingId: string, paymentData: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => Promise<{ success: boolean; message?: string }>;
}

export const useCounselingStore = create<CounselingState>((set) => ({
    counselingTypes: [],
    isLoading: false,
    error: null,

    fetchCounselingTypes: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/counseling/services`);
            if (response.data && response.data.success) {
                const types = response.data.data.services.map((s: any) => ({
                    id: s._id,
                    _id: s._id,
                    title: s.title,
                    description: s.description,
                    icon: s.icon || 'help-buoy',
                    color: s.color || '#3B82F6',
                    bgColor: s.bgColor || '#EFF6FF',
                    duration: s.duration, // Ensure string or format it
                    price: s.price,
                    isFree: s.isFree
                }));
                set({ counselingTypes: types, isLoading: false });
            } else {
                set({ counselingTypes: [], isLoading: false });
            }
        } catch (error: any) {
            console.error('Fetch Counseling Types Error:', error);
            set({ isLoading: false, error: 'Failed to load counseling types' });
        }
    },

    checkAvailability: async (date: string, counselorType: string) => {
        set({ isLoading: true, error: null });
        try {
            // Check if backend supports this, otherwise return mock slots for now to not block UI
            // In real scenario: const response = await axios.get(...)
            // For now, let's simulate a network call that returns standardized slots
            // This simulation helps verifying the UI connection flow
            await new Promise(resolve => setTimeout(resolve, 500));

            // Return dummy slots for testing "live" connection flow until backend endpoint is confirmed ready
            set({ isLoading: false });
            return [
                '09:00 AM', '10:00 AM', '11:00 AM',
                '02:00 PM', '03:00 PM', '04:00 PM'
            ];
            /* 
            // REAL IMPLEMENTATION ONCE ENDPOINT READY:
            const response = await axios.get(`${API_URL}/counseling/availability`, {
                 params: { date, counselorType }
            });
            set({ isLoading: false });
            return response.data.data.slots;
            */
        } catch (error: any) {
            console.error('Check Availability Error:', error);
            set({ isLoading: false, error: 'Failed to check availability' });
            return [];
        }
    },

    bookSession: async (bookingData: any) => {
        set({ isLoading: true, error: null });
        try {
            const token = useAuthStore.getState().token;
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const response = await axios.post(`${API_URL}/counseling/book`, bookingData, { headers });
            set({ isLoading: false });
            if (response.data.success) {
                const bookingId = response.data.data?.booking?._id;
                return { success: true, message: 'Booking confirmed', bookingId };
            }
            return { success: false, message: response.data.message || 'Booking failed' };
        } catch (error: any) {
            console.error('Book Session Error:', error);
            const msg = error.response?.data?.message || 'Booking failed';
            set({ isLoading: false, error: msg });
            return { success: false, message: msg };
        }
    },

    createBookingOrder: async (bookingId: string, amount: number) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return { success: false, message: 'Please sign in to pay.' };
            const response = await axios.post(
                `${API_URL}/payments/create-booking-order`,
                { bookingId, amount },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.data?.success && response.data?.data) {
                const d = response.data.data;
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

    verifyCounselingPayment: async (bookingId: string, paymentData: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return { success: false, message: 'Please sign in.' };
            const response = await axios.post(
                `${API_URL}/counseling/${bookingId}/payment`,
                paymentData,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.data?.success) return { success: true, message: response.data.message };
            return { success: false, message: response.data?.message || 'Payment verification failed' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Payment verification failed' };
        }
    }
}));
