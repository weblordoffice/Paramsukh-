import { NativeModules, Platform } from 'react-native';

/**
 * Shared wrapper around the `react-native-razorpay` native SDK.
 *
 * The app historically opened Razorpay *payment links* in a system browser
 * (see `paymentBrowser.ts`). The native SDK instead takes a Razorpay *order*
 * (created by our backend) and renders Razorpay's in-app checkout — no
 * WebView / browser redirect needed.
 *
 * NOTE: the native module only exists in dev-client / EAS builds
 * (it is NOT available in Expo Go or on web). Every caller must check
 * `isRazorpayNativeAvailable()` first and fall back to the
 * payment-link + browser flow when it returns false.
 */

let RazorpayCheckout: {
  open: (options: Record<string, any>) => Promise<any>;
} | null = null;

try {
  // Lazy require so the JS bundle still loads in Expo Go / web where the
  // native module is missing.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-razorpay');
  const candidate = mod?.default ?? mod;
  if (candidate && typeof candidate.open === 'function') {
    RazorpayCheckout = candidate;
  }
} catch {
  RazorpayCheckout = null;
}

export const isRazorpayNativeAvailable = (): boolean => {
  if (Platform.OS === 'web') return false;
  if (RazorpayCheckout === null) return false;
  // The JS layer loads even when the native side isn't linked (e.g. Expo Go),
  // so verify the actual native module is present before offering native checkout.
  return (NativeModules as any)?.RNRazorpayCheckout != null;
};

export interface NativeCheckoutOrder {
  /** Razorpay key id — always use the `keyId` returned by the backend, never hardcode. */
  keyId: string;
  /** Razorpay order id (`order_...`) created by the backend. */
  orderId: string;
  /** Amount in paise (as returned by the backend). */
  amount: number;
  currency?: string;
}

export interface NativeCheckoutDisplay {
  /** Merchant / app name shown on the checkout sheet. */
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  themeColor?: string;
}

export type NativePayResult =
  | { status: 'success'; paymentId: string; orderId: string; signature: string }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'error'; code?: number; message: string };

const normalizeContact = (contact?: string): string | undefined => {
  if (!contact) return undefined;
  const digits = String(contact).replace(/\D/g, '');
  // Razorpay prefill expects a 10-digit Indian mobile number (without +91).
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(-10);
  return digits || undefined;
};

const isUserCancelled = (err: any): boolean => {
  const code = Number(err?.code ?? err?.error?.code);
  if (code === 0 || code === 2) return true;
  const text = String(err?.description ?? err?.error?.description ?? err?.message ?? '').toLowerCase();
  return text.includes('cancel') || text.includes('dismiss') || text.includes('closed');
};

/**
 * Open Razorpay's native in-app checkout for a backend-created order.
 * Returns a discriminated result — never throws.
 */
export const payWithRazorpayNative = async (
  order: NativeCheckoutOrder,
  display: NativeCheckoutDisplay = {}
): Promise<NativePayResult> => {
  if (!isRazorpayNativeAvailable() || !RazorpayCheckout) {
    return { status: 'unavailable' };
  }
  if (!order?.keyId || !order?.orderId) {
    return { status: 'error', message: 'Missing Razorpay key or order id.' };
  }

  const options: Record<string, any> = {
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amount,
    currency: order.currency || 'INR',
    name: display.name || 'Paramsukh Online Gurukul',
    description: display.description || 'Payment',
    prefill: {
      ...(display.prefill?.name ? { name: display.prefill.name } : {}),
      ...(display.prefill?.email ? { email: display.prefill.email } : {}),
      ...(normalizeContact(display.prefill?.contact) ? { contact: normalizeContact(display.prefill?.contact) } : {}),
    },
    notes: display.notes,
    theme: { color: display.themeColor || '#F1842D' },
    retry: { enabled: true, max_count: 2 },
  };

  try {
    const data = await RazorpayCheckout.open(options);
    const paymentId = String(data?.razorpay_payment_id || '');
    const returnedOrderId = String(data?.razorpay_order_id || order.orderId);
    const signature = String(data?.razorpay_signature || '');
    if (!paymentId || !signature) {
      return { status: 'error', message: 'Payment completed but verification details are missing.' };
    }
    return { status: 'success', paymentId, orderId: returnedOrderId, signature };
  } catch (err: any) {
    if (isUserCancelled(err)) return { status: 'cancelled' };
    const message = String(
      err?.description ?? err?.error?.description ?? err?.message ?? 'Payment failed. Please try again.'
    );
    const codeRaw = Number(err?.code ?? err?.error?.code);
    return { status: 'error', code: Number.isFinite(codeRaw) ? codeRaw : undefined, message };
  }
};

/** Build the prefill block from the logged-in user. */
export const buildPrefill = (user?: {
  displayName?: string;
  name?: string;
  email?: string;
  phone?: string;
} | null): NativeCheckoutDisplay['prefill'] => {
  if (!user) return undefined;
  return {
    name: user.displayName || (user as any).name || undefined,
    email: user.email || undefined,
    contact: user.phone || undefined,
  };
};
