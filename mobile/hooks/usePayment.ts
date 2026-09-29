import { useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRazorpayNativeAvailable, payWithRazorpayNative, buildPrefill } from './razorpayNative';
import { openPaymentLink, savePendingPaymentLink, clearPendingPaymentLinks } from './paymentBrowser';
import { useAuthStore } from '../store/authStore';
import apiClient from '../utils/apiClient';

export const PAYMENT_TYPE = {
  ORDER: 'order',
  MEMBERSHIP: 'membership',
  DONATION: 'donation',
  COUNSELING: 'counseling',
  EVENT: 'event',
};

export const PAYMENT_STATUS = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
  CANCELLED: 'cancelled',
};

export const PENDING_PAYMENT_KEY_PREFIX = 'pending_payment_';

export interface PaymentConfig {
  type: keyof typeof PAYMENT_TYPE;
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, any>;
  onSuccess?: (result: PaymentResult) => void;
  onFailure?: (error: PaymentError) => void;
  onPending?: () => void;
}

export interface PaymentResult {
  paymentId: string;
  orderId?: string;
  provider: 'razorpay';
  amount: number;
  status: 'success';
}

export interface PaymentError {
  code?: string | number;
  message: string;
  status: 'failed' | 'cancelled' | 'error';
}

interface PendingPayment {
  type: string;
  id?: string;
  paymentLinkId?: string;
  url?: string;
  expiresAt?: string;
  createdAt: string;
}

export const usePayment = () => {
  const [status, setStatus] = useState<keyof typeof PAYMENT_STATUS>(PAYMENT_STATUS.IDLE);
  const [error, setError] = useState<PaymentError | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const processingRef = useRef(false);
  const { token } = useAuthStore();

  const savePendingPayment = useCallback(async (type: string, id: string, paymentLinkId: string, url: string, expiresAt?: string) => {
    try {
      const pending: PendingPayment = {
        type,
        id,
        paymentLinkId,
        url,
        expiresAt,
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(`${PENDING_PAYMENT_KEY_PREFIX}${type}_${id}`, JSON.stringify(pending));
    } catch (err) {
      console.warn('[usePayment] Failed to save pending payment:', err);
    }
  }, []);

  const getPendingPayment = useCallback(async (type: string, id: string): Promise<PendingPayment | null> => {
    try {
      const raw = await AsyncStorage.getItem(`${PENDING_PAYMENT_KEY_PREFIX}${type}_${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const clearPendingPayment = useCallback(async (type: string, id: string) => {
    try {
      await AsyncStorage.removeItem(`${PENDING_PAYMENT_KEY_PREFIX}${type}_${id}`);
    } catch {}
  }, []);

  const processPayment = useCallback(async (config: PaymentConfig): Promise<PaymentResult | null> => {
    if (processingRef.current) {
      console.warn('[usePayment] Payment already in progress');
      return null;
    }

    processingRef.current = true;
    setStatus(PAYMENT_STATUS.PROCESSING);
    setError(null);
    setResult(null);

    try {
      if (isRazorpayNativeAvailable()) {
        return await processNativePayment(config);
      } else {
        return await processPaymentLink(config);
      }
    } catch (err: any) {
      const paymentError: PaymentError = {
        message: err?.message || 'Payment failed',
        status: 'error',
        code: err?.code,
      };
      setError(paymentError);
      setStatus(PAYMENT_STATUS.FAILED);
      config.onFailure?.(paymentError);
      return null;
    } finally {
      processingRef.current = false;
    }
  }, []);

  const processNativePayment = useCallback(async (config: PaymentConfig): Promise<PaymentResult | null> => {
    const endpoint = getEndpointForType(config.type);
    const orderRes = await apiClient.post(endpoint.createOrder, config.metadata || {});

    if (!orderRes.data?.success || !orderRes.data?.data?.orderId) {
      throw new Error(orderRes.data?.message || 'Failed to create order');
    }

    const { orderId, amount, keyId } = orderRes.data.data;

    const payResult = await payWithRazorpayNative(
      { keyId, orderId, amount, currency: config.currency || 'INR' },
      {
        description: config.description,
        prefill: buildPrefill(useAuthStore.getState().user),
        notes: { type: config.type, ...config.metadata },
      }
    );

    if (payResult.status === 'success') {
      const verifyRes = await apiClient.post(endpoint.verify, {
        [getOrderIdField(config.type)]: orderId,
        razorpay_payment_id: payResult.paymentId,
        razorpay_order_id: payResult.orderId,
        razorpay_signature: payResult.signature,
        ...config.metadata,
      });

      if (verifyRes.data?.success) {
        const successResult: PaymentResult = {
          paymentId: payResult.paymentId,
          orderId,
          provider: 'razorpay',
          amount: config.amount,
          status: 'success',
        };
        setResult(successResult);
        setStatus(PAYMENT_STATUS.SUCCESS);
        config.onSuccess?.(successResult);
        return successResult;
      } else {
        throw new Error(verifyRes.data?.message || 'Payment verification failed');
      }
    }

    if (payResult.status === 'cancelled') {
      const cancelError: PaymentError = { message: 'Payment cancelled', status: 'cancelled' };
      setError(cancelError);
      setStatus(PAYMENT_STATUS.CANCELLED);
      config.onFailure?.(cancelError);
      return null;
    }

    throw new Error(payResult.message || 'Payment failed');
  }, []);

  const processPaymentLink = useCallback(async (config: PaymentConfig): Promise<PaymentResult | null> => {
    const endpoint = getEndpointForType(config.type);
    const linkRes = await apiClient.post(endpoint.createLink, {
      amount: config.amount,
      ...config.metadata,
    });

    if (!linkRes.data?.success || !linkRes.data?.data?.url) {
      throw new Error(linkRes.data?.message || 'Failed to create payment link');
    }

    const { url, paymentLinkId, expiresAt } = linkRes.data.data;
    const id = config.metadata?.[getIdField(config.type)];

    if (paymentLinkId && id) {
      await savePendingPayment(config.type, id, paymentLinkId, url, expiresAt);
    }

    setStatus(PAYMENT_STATUS.PENDING);
    config.onPending?.();

    const openResult = await openPaymentLink({
      url,
      paymentLinkId,
      confirm: async () => {
        const confirmRes = await apiClient.post(endpoint.confirmLink, {
          [getIdField(config.type)]: id,
          paymentLinkId,
          ...config.metadata,
        });
        return { success: !!confirmRes.data?.success, data: confirmRes.data?.data, message: confirmRes.data?.message };
      },
    });

    if (openResult.success && openResult.result?.success) {
      const successResult: PaymentResult = {
        paymentId: paymentLinkId || 'link_payment',
        orderId: id,
        provider: 'razorpay',
        amount: config.amount,
        status: 'success',
      };
      setResult(successResult);
      setStatus(PAYMENT_STATUS.SUCCESS);
      if (paymentLinkId && id) await clearPendingPayment(config.type, id);
      config.onSuccess?.(successResult);
      return successResult;
    }

    if (openResult.timedOut) {
      throw new Error('Payment confirmation timed out. Please check your payment status.');
    }

    throw new Error(openResult.result?.message || 'Payment failed or was cancelled');
  }, [savePendingPayment, clearPendingPayment]);

  const reset = useCallback(() => {
    setStatus(PAYMENT_STATUS.IDLE);
    setError(null);
    setResult(null);
  }, []);

  return {
    status,
    error,
    result,
    isProcessing: status === PAYMENT_STATUS.PROCESSING,
    isSuccess: status === PAYMENT_STATUS.SUCCESS,
    isFailed: status === PAYMENT_STATUS.FAILED,
    isPending: status === PAYMENT_STATUS.PENDING,
    processPayment,
    reset,
    getPendingPayment,
    clearPendingPayment,
  };
};

const getEndpointForType = (type: keyof typeof PAYMENT_TYPE) => {
  const endpoints = {
    [PAYMENT_TYPE.ORDER]: {
      createOrder: '/orders/create',
      verify: '/orders/verify-payment',
      createLink: '/orders/create-payment-link',
      confirmLink: '/orders/confirm-payment-link',
      getIdField: () => 'orderId',
      getOrderIdField: () => 'orderId',
    },
    [PAYMENT_TYPE.MEMBERSHIP]: {
      createOrder: '/payments/create-order',
      verify: '/payments/verify-membership',
      createLink: '/payments/membership-link',
      confirmLink: '/payments/membership-link/confirm',
      getIdField: () => 'plan',
      getOrderIdField: () => 'plan',
    },
    [PAYMENT_TYPE.DONATION]: {
      createOrder: '/donations/create-order',
      verify: '/donations/verify-payment',
      createLink: '/donations/payment-link',
      confirmLink: '/donations/confirm-payment-link',
      getIdField: () => 'donationId',
      getOrderIdField: () => 'donationId',
    },
    [PAYMENT_TYPE.COUNSELING]: {
      createOrder: '/payments/create-booking-order',
      verify: '/counseling/verify-payment',
      createLink: '/payments/booking-link',
      confirmLink: '/payments/booking-link/confirm',
      getIdField: () => 'bookingId',
      getOrderIdField: () => 'bookingId',
    },
    [PAYMENT_TYPE.EVENT]: {
      createOrder: '/events/create-order',
      verify: '/events/verify-payment',
      createLink: '/events/create-payment-link',
      confirmLink: '/events/confirm-payment-link',
      getIdField: () => 'eventId',
      getOrderIdField: () => 'eventId',
    },
  };
  return endpoints[type];
};

const getIdField = (type: keyof typeof PAYMENT_TYPE) => getEndpointForType(type).getIdField();
const getOrderIdField = (type: keyof typeof PAYMENT_TYPE) => getEndpointForType(type).getOrderIdField();
