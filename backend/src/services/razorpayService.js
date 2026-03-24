import Razorpay from 'razorpay';
import crypto from 'crypto';

// Test mode flag - set to true to use without real Razorpay keys
const TEST_MODE = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'test';

let razorpayInstance = null;

// Initialize Razorpay only if keys are available
if (!TEST_MODE) {
  try {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay initialized successfully');
  } catch (error) {
    console.error('❌ Razorpay initialization failed:', error.message);
  }
}

/**
 * Create a Razorpay order
 */
export const createRazorpayOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
  try {
    // Test mode - return mock order
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Creating mock Razorpay order');
      const mockOrder = {
        id: `order_test_${Date.now()}`,
        entity: 'order',
        amount: amount * 100, // Convert to paise
        amount_paid: 0,
        amount_due: amount * 100,
        currency,
        receipt,
        status: 'created',
        attempts: 0,
        notes,
        created_at: Math.floor(Date.now() / 1000)
      };
      return mockOrder;
    }

    // Real Razorpay order
    const options = {
      amount: amount * 100, // Convert to paise (1 INR = 100 paise)
      currency,
      receipt,
      notes
    };

    const order = await razorpayInstance.orders.create(options);
    console.log('✅ Razorpay order created:', order.id);
    return order;

  } catch (error) {
    console.error('❌ Error creating Razorpay order:', error);
    const msg = error?.error?.description || error?.message || error?.statusCode || 'Unknown error';
    const hint = error?.statusCode === 401
      ? ' Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env (Razorpay Dashboard → API Keys). Or set RAZORPAY_KEY_ID=test for mock mode.'
      : '';
    throw new Error('Failed to create payment order: ' + msg + hint);
  }
};

/**
 * Create a Razorpay payment link (hosted checkout page)
 */
export const createRazorpayPaymentLink = async ({
  amount,
  currency = 'INR',
  description,
  customer,
  notes = {},
  callback_url,
  callback_method = 'get',
}) => {
  try {
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    // Test mode - return mock link
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Creating mock Razorpay payment link');
      return {
        id: `plink_test_${Date.now()}`,
        short_url: `https://rzp.io/i/test_${Date.now()}`,
        currency,
        amount: amount * 100,
        description,
        notes,
        status: 'created',
        customer: customer || null,
        callback_url: callback_url || null,
        callback_method,
      };
    }

    if (!razorpayInstance?.paymentLink?.create) {
      throw new Error('Razorpay paymentLink API not available');
    }

    const payload = {
      amount: amount * 100, // paise
      currency,
      description,
      customer,
      notes,
      ...(callback_url ? { callback_url, callback_method } : {}),
    };

    const link = await razorpayInstance.paymentLink.create(payload);
    console.log('✅ Razorpay payment link created:', link.id);
    return link;
  } catch (error) {
    console.error('❌ Error creating Razorpay payment link:', error);
    const msg = error?.error?.description || error?.message || error?.statusCode || 'Unknown error';
    const hint = error?.statusCode === 401
      ? ' Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env (Razorpay Dashboard → API Keys).'
      : '';
    throw new Error('Failed to create payment link: ' + msg + hint);
  }
};

/**
 * Fetch a Razorpay payment link by id
 */
export const fetchPaymentLink = async (paymentLinkId) => {
  try {
    if (!paymentLinkId) {
      throw new Error('Payment Link ID is required');
    }

    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Fetching mock payment link');
      // In test mode we can't actually know; assume paid to unblock local dev flows.
      return {
        id: paymentLinkId,
        status: 'paid',
        amount: 0,
        amount_paid: 0,
        currency: 'INR',
        short_url: `https://rzp.io/i/${paymentLinkId}`,
        notes: {},
        payments: { payment_id: `pay_test_${Date.now()}`, status: 'captured' }
      };
    }

    if (!razorpayInstance?.paymentLink?.fetch) {
      throw new Error('Razorpay paymentLink fetch API not available');
    }

    return await razorpayInstance.paymentLink.fetch(paymentLinkId);
  } catch (error) {
    console.error('❌ Error fetching payment link:', error);
    const msg = error?.error?.description || error?.message || 'Unknown error';
    throw new Error('Failed to fetch payment link: ' + msg);
  }
};

/**
 * List recent payment links (for sync – find paid link for user)
 */
export const listPaymentLinks = async (options = { count: 20 }) => {
  try {
    if (TEST_MODE) {
      return { items: [] };
    }
    if (!razorpayInstance?.paymentLink?.all) {
      return { items: [] };
    }
    const result = await razorpayInstance.paymentLink.all(options);
    return result || { items: [] };
  } catch (error) {
    console.error('❌ Error listing payment links:', error);
    return { items: [] };
  }
};

/**
 * Verify Razorpay payment signature
 */
export const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  try {
    // Test mode - always return true for test payments
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Verifying mock payment');
      // Simple validation for test mode
      if (orderId && orderId.startsWith('order_test_') && 
          paymentId && paymentId.startsWith('pay_test_')) {
        return true;
      }
      return false;
    }

    // Real signature verification
    const text = orderId + '|' + paymentId;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    const isValid = generatedSignature === signature;
    console.log(isValid ? '✅ Payment signature verified' : '❌ Invalid payment signature');
    return isValid;

  } catch (error) {
    console.error('❌ Error verifying signature:', error);
    return false;
  }
};

/**
 * Verify Razorpay webhook signature
 */
export const verifyRazorpayWebhookSignature = (payload, signature) => {
  try {
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Webhook signature verification bypassed');
      return true;
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!webhookSecret || !signature) {
      return false;
    }

    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return false;
  }
};

/**
 * Fetch payment details
 */
export const fetchPaymentDetails = async (paymentId) => {
  try {
    // Test mode - return mock payment details
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Fetching mock payment details');
      return {
        id: paymentId,
        entity: 'payment',
        amount: 100000, // Mock amount
        currency: 'INR',
        status: 'captured',
        method: 'card',
        captured: true,
        email: 'test@example.com',
        contact: '+919999999999',
        created_at: Math.floor(Date.now() / 1000)
      };
    }

    // Real payment fetch
    const payment = await razorpayInstance.payments.fetch(paymentId);
    console.log('✅ Payment details fetched:', paymentId);
    return payment;

  } catch (error) {
    console.error('❌ Error fetching payment:', error);
    throw new Error('Failed to fetch payment details');
  }
};

/**
 * Create refund
 */
export const createRefund = async (paymentId, amount = null, notes = {}) => {
  try {
    // Test mode - return mock refund
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Creating mock refund');
      return {
        id: `rfnd_test_${Date.now()}`,
        entity: 'refund',
        amount: amount || 100000,
        currency: 'INR',
        payment_id: paymentId,
        notes,
        status: 'processed',
        created_at: Math.floor(Date.now() / 1000)
      };
    }

    // Real refund
    const refundData = {
      notes
    };
    if (amount) {
      refundData.amount = amount * 100; // Convert to paise
    }

    const refund = await razorpayInstance.payments.refund(paymentId, refundData);
    console.log('✅ Refund created:', refund.id);
    return refund;

  } catch (error) {
    console.error('❌ Error creating refund:', error);
    throw new Error('Failed to create refund');
  }
};

/**
 * Verify webhook signature
 */
export const verifyWebhookSignature = (body, signature) => {
  try {
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Webhook signature verification skipped');
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('❌ Webhook signature verification failed:', error);
    return false;
  }
};

// Export test mode status for other modules
export const isTestMode = () => TEST_MODE;

export default {
  createRazorpayOrder,
  createRazorpayPaymentLink,
  fetchPaymentLink,
  listPaymentLinks,
  verifyRazorpaySignature,
  fetchPaymentDetails,
  createRefund,
  verifyWebhookSignature,
  isTestMode
};
