import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuthStore } from './authStore';

export interface Reward {
    _id: string;
    title: string;
    description: string;
    pointsCost: number;
    emoji: string;
    color: string;
    bgColor: string;
    category: 'Badge' | 'Gift' | 'Benefit';
    isAvailable: boolean;
}

export interface PointHistoryItem {
    _id: string;
    activity: string;
    points: number;
    date: string;
    type: 'earn' | 'redeem';
    createdAt: string;
}

interface RewardsState {
    totalPoints: number;
    currentLevel: string;
    history: PointHistoryItem[];
    rewards: Reward[];
    redeemedRewards: string[]; // IDs of redeemed rewards
    isLoading: boolean;

    fetchRewardsStatus: () => Promise<void>;
    fetchRewardsCatalog: () => Promise<void>;
    redeemReward: (rewardId: string) => Promise<{ success: boolean; message: string }>;
}

export const useRewardStore = create<RewardsState>((set, get) => ({
    totalPoints: 0,
    currentLevel: 'Beginner',
    history: [],
    rewards: [],
    redeemedRewards: [],
    isLoading: false,

    fetchRewardsStatus: async () => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return;

            const response = await axios.get(`${API_URL}/auth/rewards/my-status`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                const { totalPoints, currentLevel, history, redeemed } = response.data.data;
                set({
                    totalPoints,
                    currentLevel,
                    history,
                    redeemedRewards: redeemed.map((r: any) => r.rewardId._id || r.rewardId)
                });
            }
        } catch (error) {
            console.error('Fetch Rewards Status Error:', error);
        }
    },

    fetchRewardsCatalog: async () => {
        try {
            set({ isLoading: true });
            const response = await axios.get(`${API_URL}/auth/rewards/catalog`);
            if (response.data.success) {
                set({ rewards: response.data.data, isLoading: false });
            }
        } catch (error) {
            console.error('Fetch Rewards Catalog Error:', error);
            set({ isLoading: false });
        }
    },

    redeemReward: async (rewardId: string) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return { success: false, message: 'Not authenticated' };

            const response = await axios.post(
                `${API_URL}/auth/rewards/redeem/${rewardId}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                // Refresh status to update points and history
                await get().fetchRewardsStatus();
                return { success: true, message: response.data.message };
            }
            return { success: false, message: 'Failed to redeem' };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || 'Redemption failed'
            };
        }
    }
}));
