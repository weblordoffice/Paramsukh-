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
    clearError: () => void;
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
                    currentSubscription: response.data.subscription,
                    isLoading: false
                });
            } else {
                console.log('Fetch subscription response:', response.data);
                // Maybe no subscription yet, so null is valid
                set({ isLoading: false, currentSubscription: null, error: null });
            }
        } catch (error: any) {
            // Silently handle subscription fetch errors - don't show to user
            if (__DEV__) {
                console.log('❌ Could not load subscription details');
                console.log('❌ Error:', error?.message);
                console.log('❌ Response:', error?.response?.data);
                console.log('❌ Status:', error?.response?.status);
            }
            // Don't logout or show errors - user might be on free tier or offline
            set({
                isLoading: false,
                currentSubscription: null,
                error: null
            });
        }
    },

    purchaseMembership: async (planId: string, paymentId: string) => {
        set({ isPurchasing: true, error: null });
        try {
            const token = useAuthStore.getState().token;
            if (!token) {
                set({ isPurchasing: false, error: 'You must be logged in to purchase.' });
                return false;
            }

            const response = await apiClient.post('/user/membership/purchase', {
                plan: planId,
                paymentId
            });

            if (response.data.success) {
                // Update current subscription
                set({
                    currentSubscription: response.data.subscription,
                    isPurchasing: false
                });
                return true;
            } else {
                set({ isPurchasing: false, error: response.data.message });
                return false;
            }
        } catch (error: any) {
            if (__DEV__) {
                console.error('Purchase Error:', error);
            }
            
            let userMessage = 'Unable to complete purchase. Please try again.';
            
            if (error.response?.status === 401) {
                userMessage = 'Session expired. Please sign in again.';
                useAuthStore.getState().logout();
            } else if (error.response?.status === 400) {
                userMessage = error.response?.data?.message || 'Invalid purchase details. Please check and try again.';
            } else if (!error.response) {
                userMessage = 'No internet connection. Please check your network and try again.';
            }
            
            set({
                isPurchasing: false,
                error: userMessage
            });
            return false;
        }
    },

    clearError: () => set({ error: null })
}));
