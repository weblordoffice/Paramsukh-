import { create } from 'zustand';
import apiClient from '../utils/apiClient';
import { API_URL } from '../config/api';
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
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.get(`${API_URL}/orders/my-orders`);
            if (response.data?.success) {
                set({ orders: response.data?.data?.orders ?? [], isLoading: false });
            }
        } catch (error: any) {
            set({ isLoading: false, error: 'Failed to load orders' });
        }
    },

    createOrder: async (orderData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.post(
                `${API_URL}/orders/create`,
                orderData
            );

            if (response.data?.success) {
                set({ isLoading: false });
                return {
                    success: true,
                    orderId: response.data?.data?.order?._id || '',
                    razorpay: response.data?.data?.razorpay // Return razorpay details if present
                };
            }
            return { success: false, message: 'Failed to create order' };
        } catch (error: any) {
            set({ isLoading: false, error: error.response?.data?.message || 'Order creation failed' });
            return { success: false, message: error.response?.data?.message || 'Order failed' };
        }
    },

    verifyPayment: async (paymentData) => {
        set({ isLoading: true });
        try {
            const response = await apiClient.post(
                `${API_URL}/orders/verify-payment`,
                paymentData
            );

            if (response.data?.success) {
                set({ isLoading: false });
                return { success: true };
            }
            return { success: false, message: 'Payment verification failed' };
        } catch (error: any) {
            set({ isLoading: false, error: 'Payment verification failed' });
            return { success: false, message: error.response?.data?.message || 'Verification failed' };
        }
    },

    createOrderPaymentLink: async (orderId: string) => {
        try {
            const response = await apiClient.post(
                `${API_URL}/orders/${orderId}/payment-link`
            );
            if (response.data?.success && response.data?.data)
                return {
                    success: true,
                    url: response.data?.data?.url,
                    paymentLinkId: response.data?.data?.paymentLinkId
                };
            return { success: false, message: response.data?.message || 'Failed to create payment link' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Failed to create payment link' };
        }
    },

    confirmOrderPaymentLink: async (orderId: string, paymentLinkId: string) => {
        try {
            const response = await apiClient.post(
                `${API_URL}/orders/confirm-payment-link`,
                { orderId, paymentLinkId }
            );
            if (response.data?.success) return { success: true, message: response.data?.message };
            return { success: false, message: response.data?.message || 'Payment confirmation failed' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Payment confirmation failed' };
        }
    },

    fetchOrderDetails: async (orderId: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.get(`${API_URL}/orders/${orderId}`);
            if (response.data?.success) {
                set({ currentOrder: response.data?.data?.order, isLoading: false });
            }
        } catch (error: any) {
            set({ isLoading: false, error: 'Failed to load order details' });
        }
    },

    cancelOrder: async (orderId: string) => {
        set({ isLoading: true });
        try {
            const response = await apiClient.patch(
                `${API_URL}/orders/${orderId}/cancel`
            );

            if (response.data?.success) {
                set((state) => ({
                    orders: state.orders.map(o => o._id === orderId ? { ...o, status: 'cancelled' } : o),
                    currentOrder: state.currentOrder?._id === orderId ? { ...state.currentOrder, status: 'cancelled' } : state.currentOrder,
                    isLoading: false
                }));
            }
        } catch (error: any) {
            set({ isLoading: false, error: 'Failed to cancel order' });
        }
    }
}));
