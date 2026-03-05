import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuthStore } from './authStore';

export interface Donation {
    _id: string;
    amount: number;
    message: string;
    status: string;
    createdAt: string;
}

interface DonationState {
    donations: Donation[];
    isLoading: boolean;

    fetchMyDonations: () => Promise<void>;
    recordDonation: (data: {
        amount: number;
        transactionId?: string;
        paymentMethod: string;
        message?: string;
        isAnonymous?: boolean;
    }) => Promise<{ success: boolean; message: string }>;
}

export const useDonationStore = create<DonationState>((set) => ({
    donations: [],
    isLoading: false,

    fetchMyDonations: async () => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return;

            set({ isLoading: true });
            const response = await axios.get(`${API_URL}/auth/donations/my-history`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                set({ donations: response.data.data, isLoading: false });
            }
        } catch (error) {
            console.error('Fetch Donations Error:', error);
            set({ isLoading: false });
        }
    },

    recordDonation: async (data) => {
        try {
            const token = useAuthStore.getState().token;
            // Allow anonymous donation if we support it later, but for now require token
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const response = await axios.post(`${API_URL}/auth/donations/record`, data, {
                headers
            });

            if (response.data.success) {
                return { success: true, message: 'Thank you for your donation!' };
            }
            return { success: false, message: 'Failed to record donation' };
        } catch (error: any) {
            console.error('Record Donation Error:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to record donation'
            };
        }
    }
}));
