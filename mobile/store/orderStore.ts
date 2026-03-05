import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuthStore } from './authStore';

export interface Order {
    _id: string;
    orderNumber: string;
    user: string;
    items: {
        product: {
            _id: string;
            name: string;
            thumbnailUrl?: string; // or image
            image?: string;
        };
        quantity: number;
        price: number;
        subtotal: number;
    }[];
    totalAmount: number;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
    shippingAddress: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
        phone: string;
    };
    createdAt: string;
}

interface OrderState {
    orders: Order[];
    currentOrder: Order | null;
    isLoading: boolean;
    error: string | null;

    fetchMyOrders: () => Promise<void>;
    createOrder: (data: {
        addressId: string;
        paymentMethod: string;
        customerNotes?: string;
    }) => Promise<{ success: boolean; orderId?: string; message?: string; razorpay?: any }>;
    verifyPayment: (data: {
        orderId: string;
        razorpayPaymentId: string;
        razorpayOrderId: string;
        razorpaySignature: string;
    }) => Promise<{ success: boolean; message?: string }>;
    createOrderPaymentLink: (orderId: string) => Promise<{ success: boolean; url?: string; paymentLinkId?: string; message?: string }>;
    confirmOrderPaymentLink: (orderId: string, paymentLinkId: string) => Promise<{ success: boolean; message?: string }>;
    fetchOrderDetails: (orderId: string) => Promise<void>;
    cancelOrder: (orderId: string) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set) => ({
    orders: [],
    currentOrder: null,
    isLoading: false,
    error: null,

    fetchMyOrders: async () => {
        const token = useAuthStore.getState().token;
        if (!token) return;

        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/orders/my-orders`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                set({ orders: response.data.data.orders, isLoading: false });
            }
        } catch (error: any) {
            console.error('Fetch Orders Error:', error);
            set({ isLoading: false, error: 'Failed to load orders' });
        }
    },

    createOrder: async (orderData) => {
        const token = useAuthStore.getState().token;
        if (!token) return { success: false, message: 'Please login' };

        set({ isLoading: true, error: null });
        try {
            const response = await axios.post(
                `${API_URL}/orders/create`,
                orderData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                set({ isLoading: false });
                return {
                    success: true,
                    orderId: response.data.data.order._id,
                    razorpay: response.data.data.razorpay // Return razorpay details if present
                };
            }
            return { success: false, message: 'Failed to create order' };
        } catch (error: any) {
            console.error('Create Order Error:', error);
            set({ isLoading: false, error: error.response?.data?.message || 'Order creation failed' });
            return { success: false, message: error.response?.data?.message || 'Order failed' };
        }
    },

    verifyPayment: async (paymentData) => {
        const token = useAuthStore.getState().token;
        if (!token) return { success: false, message: 'Please login' };

        set({ isLoading: true });
        try {
            const response = await axios.post(
                `${API_URL}/orders/verify-payment`,
                paymentData,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                set({ isLoading: false });
                return { success: true };
            }
            return { success: false, message: 'Payment verification failed' };
        } catch (error: any) {
            console.error('Verify Payment Error:', error);
            set({ isLoading: false, error: 'Payment verification failed' });
            return { success: false, message: error.response?.data?.message || 'Verification failed' };
        }
    },

    createOrderPaymentLink: async (orderId: string) => {
        const token = useAuthStore.getState().token;
        if (!token) return { success: false, message: 'Please login' };
        try {
            const response = await axios.post(
                `${API_URL}/orders/${orderId}/payment-link`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.data?.success && response.data?.data)
                return {
                    success: true,
                    url: response.data.data.url,
                    paymentLinkId: response.data.data.paymentLinkId
                };
            return { success: false, message: response.data?.message || 'Failed to create payment link' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Failed to create payment link' };
        }
    },

    confirmOrderPaymentLink: async (orderId: string, paymentLinkId: string) => {
        const token = useAuthStore.getState().token;
        if (!token) return { success: false, message: 'Please login' };
        try {
            const response = await axios.post(
                `${API_URL}/orders/confirm-payment-link`,
                { orderId, paymentLinkId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.data?.success) return { success: true, message: response.data.message };
            return { success: false, message: response.data?.message || 'Payment confirmation failed' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Payment confirmation failed' };
        }
    },

    fetchOrderDetails: async (orderId: string) => {
        const token = useAuthStore.getState().token;
        if (!token) return;

        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                set({ currentOrder: response.data.data.order, isLoading: false });
            }
        } catch (error: any) {
            console.error('Fetch Order Detail Error:', error);
            set({ isLoading: false, error: 'Failed to load order details' });
        }
    },

    cancelOrder: async (orderId: string) => {
        const token = useAuthStore.getState().token;
        if (!token) return;

        set({ isLoading: true });
        try {
            const response = await axios.patch(
                `${API_URL}/orders/${orderId}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                // Update local state if needed
                set((state) => ({
                    orders: state.orders.map(o => o._id === orderId ? { ...o, status: 'cancelled' } : o),
                    currentOrder: state.currentOrder?._id === orderId ? { ...state.currentOrder, status: 'cancelled' } : state.currentOrder,
                    isLoading: false
                }));
            }
        } catch (error: any) {
            console.error('Cancel Order Error:', error);
            set({ isLoading: false, error: 'Failed to cancel order' });
        }
    }
}));
