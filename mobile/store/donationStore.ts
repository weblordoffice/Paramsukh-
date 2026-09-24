import { create } from 'zustand';
import apiClient from '../utils/apiClient';
import { API_URL } from '../config/api';
export interface Donation {
    _id: string;
    amount: number;
    message: string;
    status: string;
    createdAt: string;
    transactionId?: string;
    receiptNumber?: string;
    paymentMethod?: string;
    isAnonymous?: boolean;
    userName?: string;
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
    createDonationOrder: (amount: number) => Promise<{
        success: boolean;
        orderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        message?: string;
    }>;
    verifyDonationPayment: (data: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        amount: number;
        message?: string;
        isAnonymous?: boolean;
    }) => Promise<{ success: boolean; message?: string; data?: any }>;
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
    },

    createDonationOrder: async (amount: number) => {
        try {
            const response = await apiClient.post(`${API_URL}/donations/create-order`, { amount });
            if (response.data?.success && response.data?.data) {
                const d = response.data.data;
                return {
                    success: true,
                    orderId: d.orderId,
                    amount: d.amount,
                    currency: d.currency || 'INR',
                    keyId: d.keyId,
                };
            }
            return { success: false, message: response.data?.message || 'Failed to create payment order' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Failed to create payment order' };
        }
    },

    verifyDonationPayment: async (data) => {
        try {
            const response = await apiClient.post(`${API_URL}/donations/verify-payment`, data);
            if (response.data?.success) {
                return { success: true, message: response.data?.message, data: response.data?.data };
            }
            return { success: false, message: response.data?.message || 'Payment verification failed' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Payment verification failed' };
        }
    }
}));
