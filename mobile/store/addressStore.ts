import { create } from 'zustand';
import apiClient from '../utils/apiClient';
import { API_URL } from '../config/api';
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
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.get(`${API_URL}/addresses`);
            if (response.data?.success) {
                set({ addresses: response.data?.data?.addresses ?? [], isLoading: false });
            } else {
                set({ isLoading: false, error: 'Failed to fetch addresses' });
            }
        } catch (error: any) {
            set({ isLoading: false, error: 'Failed to fetch addresses' });
        }
    },

    addAddress: async (addressData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.post(
                `${API_URL}/addresses/add`,
                addressData
            );

            if (response.data?.success) {
                const newAddress = response.data?.data?.address;
                set((state) => ({
                    addresses: [newAddress, ...state.addresses],
                    isLoading: false
                }));
                return newAddress;
            }
            return null;
        } catch (error: any) {
            set({ isLoading: false, error: error.response?.data?.message || 'Failed to add address' });
            return null;
        }
    },

    updateAddress: async (id, addressData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.patch(
                `${API_URL}/addresses/${id}`,
                addressData
            );
            if (response.data?.success) {
                const updated = response.data?.data?.address;
                set((state) => ({
                    addresses: state.addresses.map((a) =>
                        a._id === id ? { ...a, ...updated } : a
                    ),
                    isLoading: false,
                }));
                return true;
            }
            set({ isLoading: false, error: response.data?.message || 'Failed to update address' });
            return false;
        } catch (error: any) {
            set({ isLoading: false, error: error.response?.data?.message || 'Failed to update address' });
            return false;
        }
    },

    deleteAddress: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.delete(`${API_URL}/addresses/${id}`);
            if (response.data?.success) {
                set((state) => ({
                    addresses: state.addresses.filter((a) => a._id !== id),
                    isLoading: false,
                }));
                return true;
            }
            set({ isLoading: false, error: response.data?.message || 'Failed to delete address' });
            return false;
        } catch (error: any) {
            set({ isLoading: false, error: error.response?.data?.message || 'Failed to delete address' });
            return false;
        }
    }
}));
