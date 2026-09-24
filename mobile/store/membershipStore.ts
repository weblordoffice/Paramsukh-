import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuthStore } from './authStore';
import apiClient from '../utils/apiClient';

export interface MembershipPlan {
    id: string;
    name: string;
    price: number;
    emoji: string;
    color: string;
    gradient: string[];
    tagline: string;
    features: { text: string; included: boolean }[];
    popular: boolean;
    courseAccess: string[];
}

export interface Subscription {
    plan: string;
    variant?: string | null;
    selectedPlan?: string;
    selectedPlanLabel?: string;
    status: 'active' | 'inactive' | 'expired' | 'cancelled';
    trialEndsAt?: string;
    isTrialActive: boolean;
    trialDaysLeft: number;
    hasProAccess: boolean;
    effectivePlans?: string[];
}

interface MembershipState {
    currentSubscription: Subscription | null;
    isLoading: boolean;
    error: string | null;
    isPurchasing: boolean;

    fetchCurrentSubscription: () => Promise<void>;
    purchaseMembership: (planId: string, paymentId: string) => Promise<boolean>;
    createMembershipOrder: (plan: string, selectedCourseIds?: string[]) => Promise<{
        success: boolean;
        orderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        message?: string;
    }>;
    verifyMembershipPayment: (data: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        plan: string;
        selectedCourseIds?: string[];
    }) => Promise<{ success: boolean; message?: string; data?: any }>;
    clearError: () => void;
    clearMembership: () => void;
}

export const useMembershipStore = create<MembershipState>((set) => ({
    currentSubscription: null,
    isLoading: false,
    error: null,
    isPurchasing: false,

    fetchCurrentSubscription: async () => {
        set({ isLoading: true, error: null });
        try {
            const token = useAuthStore.getState().token;
            if (!token) {
                // Not logged in, can't fetch subscription
                set({ isLoading: false, currentSubscription: null });
                return;
            }

            const response = await apiClient.get('/user/subscription');

            if (response.data && response.data.success) {
                set({
                    currentSubscription: response.data?.subscription,
                    isLoading: false
                });
            } else {
                // Maybe no subscription yet, so null is valid
                set({ isLoading: false, currentSubscription: null, error: null });
            }
        } catch (error: any) {
            // Preserve previous subscription state on network errors
            const prev = useMembershipStore.getState().currentSubscription;
            set({ isLoading: false, currentSubscription: prev, error: 'Failed to load subscription' });
        }
    },

    /** @deprecated Use direct apiClient calls in screens — see membership-new.tsx / my-membership.tsx */
    purchaseMembership: async (_planId: string, _paymentId: string) => {
        console.warn('[MembershipStore] purchaseMembership is deprecated. Use the payment-link flow instead.');
        return false;
    },

    createMembershipOrder: async (plan: string, selectedCourseIds?: string[]) => {
        try {
            const response = await apiClient.post('/payments/create-order', { plan, selectedCourseIds });
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

    verifyMembershipPayment: async (data) => {
        try {
            const response = await apiClient.post('/payments/verify-membership', data);
            if (response.data?.success) {
                return { success: true, message: response.data?.message, data: response.data?.data };
            }
            return { success: false, message: response.data?.message || 'Payment verification failed' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Payment verification failed' };
        }
    },

    clearError: () => set({ error: null }),

    clearMembership: () => set({
        currentSubscription: null,
        isLoading: false,
        error: null,
        isPurchasing: false
    })
}));
