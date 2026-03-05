import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuthStore } from './authStore';

interface Address {
    _id: string;
    type: string; // 'Home', 'Work', etc.
    fullName: string;
    phone: string;
    alternatePhone?: string;
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    isDefault: boolean;
}

interface AddressState {
    addresses: Address[];
    isLoading: boolean;
    error: string | null;

    fetchAddresses: () => Promise<void>;
    addAddress: (addressData: Omit<Address, '_id'>) => Promise<Address | null>;
    updateAddress: (id: string, addressData: Partial<Address>) => Promise<boolean>;
    deleteAddress: (id: string) => Promise<boolean>;
}

export const useAddressStore = create<AddressState>((set) => ({
    addresses: [],
    isLoading: false,
    error: null,

    fetchAddresses: async () => {
        const token = useAuthStore.getState().token;
        if (!token) return;

        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/addresses`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                set({ addresses: response.data.data.addresses, isLoading: false });
            } else {
                set({ isLoading: false, error: 'Failed to fetch addresses' });
            }
        } catch (error: any) {
            console.error('Fetch Addresses Error:', error);
            set({ isLoading: false, error: 'Failed to fetch addresses' });
        }
    },

    addAddress: async (addressData) => {
        const token = useAuthStore.getState().token;
        if (!token) return null;

        set({ isLoading: true, error: null });
        try {
            const response = await axios.post(
                `${API_URL}/addresses/add`,
                addressData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                const newAddress = response.data.data.address;
                set((state) => ({
                    addresses: [newAddress, ...state.addresses],
                    isLoading: false
                }));
                return newAddress;
            }
            return null;
        } catch (error: any) {
            console.error('Add Address Error:', error);
            set({ isLoading: false, error: error.response?.data?.message || 'Failed to add address' });
            return null;
        }
    },

    updateAddress: async (id, addressData) => {
        // Implementation for update if needed later
        return true;
    },

    deleteAddress: async (id) => {
        // Implementation for delete if needed later
        return true;
    }
}));
