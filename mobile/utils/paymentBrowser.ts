import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_PAYMENT_LINK_KEY = 'pending_payment_link';

export interface PendingPaymentLink {
  type: 'order' | 'event' | 'counseling' | 'membership' | 'podcast' | 'donation';
  id?: string; // orderId / eventId / bookingId / plan slug
  paymentLinkId?: string;
  url?: string;
  expiresAt?: string; // ISO date
  confirmPayload?: Record<string, any>;
}

export interface ConfirmResult {
  success: boolean;
  data?: any;
  message?: string;
}

export interface PollOptions {
  maxAttempts?: number;
  baseIntervalMs?: number;
  backoff?: number;
}

export interface OpenPaymentLinkOptions {
  url: string;
  paymentLinkId?: string;
  confirm: () => Promise<ConfirmResult>;
  maxAttempts?: number;
  baseIntervalMs?: number;
  useAuthSession?: boolean;
  callbackUrl?: string;
  /** Native-only browser options */
  browserOptions?: WebBrowser.WebBrowserOpenOptions;
}

/**
 * Poll a confirm callback until it succeeds or we run out of attempts.
 * Useful when the user pays in an external browser and we need to wait for
 * Razorpay to notify the backend.
 */
export const pollPaymentConfirmation = async (
  confirm: () => Promise<ConfirmResult>,
  options: PollOptions = {}
): Promise<{ success: boolean; result?: ConfirmResult; attempts: number; exhausted: boolean }> => {
  const { maxAttempts = 10, baseIntervalMs = 3000, backoff = 1.5 } = options;

  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const result = await confirm();
      if (result.success) {
        return { success: true, result, attempts, exhausted: false };
      }
    } catch (error) {
      // Network/backend hiccup: keep polling
      console.warn(`[PaymentBrowser] Poll attempt ${attempts} failed`, error);
    }

    if (attempts < maxAttempts) {
      const delay = Math.round(baseIntervalMs * Math.pow(backoff, attempts - 1));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { success: false, attempts, exhausted: true };
};

/**
 * Open a Razorpay payment link in the system browser and then poll the
 * backend confirmation endpoint.
 */
export const openPaymentLink = async (
  options: OpenPaymentLinkOptions
): Promise<{ opened: boolean; success: boolean; result?: ConfirmResult; attempts: number; exhausted: boolean; error?: any }> => {
  const { url, confirm, useAuthSession, callbackUrl } = options;

  try {
    if (useAuthSession && callbackUrl) {
      await WebBrowser.openAuthSessionAsync(url, callbackUrl, { createTask: false });
    } else {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        enableBarCollapsing: true,
        showTitle: true,
        ...options.browserOptions,
      });
    }
  } catch (error) {
    console.error('[PaymentBrowser] Failed to open browser', error);
    return { opened: false, success: false, attempts: 0, exhausted: false, error };
  }

  const poll = await pollPaymentConfirmation(confirm, {
    maxAttempts: options.maxAttempts,
    baseIntervalMs: options.baseIntervalMs,
  });

  return { opened: true, ...poll };
};

/**
 * Persist a pending payment link so the app can retry confirmation later.
 */
export const savePendingPaymentLink = async (pending: PendingPaymentLink): Promise<void> => {
  try {
    const existingRaw = await AsyncStorage.getItem(PENDING_PAYMENT_LINK_KEY);
    const existing: PendingPaymentLink[] = existingRaw ? JSON.parse(existingRaw) : [];
    const filtered = existing.filter(
      (item) => !(item.type === pending.type && item.id === pending.id && item.paymentLinkId === pending.paymentLinkId)
    );
    filtered.push(pending);
    await AsyncStorage.setItem(PENDING_PAYMENT_LINK_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[PaymentBrowser] Failed to save pending payment link', error);
  }
};

/**
 * Retrieve pending payment links. Optionally filter by type.
 */
export const getPendingPaymentLinks = async (type?: PendingPaymentLink['type']): Promise<PendingPaymentLink[]> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_PAYMENT_LINK_KEY);
    if (!raw) return [];
    const parsed: PendingPaymentLink[] = JSON.parse(raw);
    if (type) return parsed.filter((item) => item.type === type);
    return parsed;
  } catch (error) {
    console.error('[PaymentBrowser] Failed to read pending payment links', error);
    return [];
  }
};

/**
 * Clear pending payment links. If type and id are provided, only matching entries are removed.
 */
export const clearPendingPaymentLinks = async (
  type?: PendingPaymentLink['type'],
  id?: string,
  paymentLinkId?: string
): Promise<void> => {
  try {
    // Prevent accidental full deletion — require at least one filter
    if (!type && !id && !paymentLinkId) return;

    const raw = await AsyncStorage.getItem(PENDING_PAYMENT_LINK_KEY);
    if (!raw) return;
    const parsed: PendingPaymentLink[] = JSON.parse(raw);
    const filtered = parsed.filter((item) => {
      if (type && item.type !== type) return true;
      if (id && item.id !== id) return true;
      if (paymentLinkId && item.paymentLinkId !== paymentLinkId) return true;
      return false;
    });
    await AsyncStorage.setItem(PENDING_PAYMENT_LINK_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[PaymentBrowser] Failed to clear pending payment links', error);
  }
};

/**
 * Check if a given pending payment link is expired.
 */
export const isPendingPaymentExpired = (pending: PendingPaymentLink): boolean => {
  if (!pending.expiresAt) return false;
  return new Date(pending.expiresAt).getTime() < Date.now() + 5 * 60 * 1000;
};
