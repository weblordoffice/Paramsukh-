import { create } from 'zustand';
import apiClient from '../utils/apiClient';
import { API_URL } from '../config/api';
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
            set({ isLoading: true });
            const response = await apiClient.get(`${API_URL}/donations/my-history`);

            if (response.data?.success) {
                set({ donations: response.data?.data ?? [], isLoading: false });
            }
        } catch (error) {
            set({ isLoading: false });
        }
    },

    recordDonation: async (data) => {
        try {
            const response = await apiClient.post(`${API_URL}/donations/record`, data);

            if (response.data?.success) {
                return { success: true, message: 'Thank you for your donation!' };
            }
            return { success: false, message: 'Failed to record donation' };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to record donation'
            };
        }
    }
}));
