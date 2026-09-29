import PaymentAuditLog from '../models/paymentAuditLog.models.js';

export const logPaymentAudit = async ({
  paymentId,
  orderId,
  userId,
  action,
  provider,
  providerRef,
  amount,
  currency,
  metadata,
  status,
  errorMessage,
  ip,
  userAgent,
}) => {
  try {
    const entry = await PaymentAuditLog.create({
      paymentId,
      orderId,
      userId,
      action,
      provider,
      providerRef,
      amount,
      currency,
      metadata,
      status,
      errorMessage,
      ip,
      userAgent,
    });
    return entry;
  } catch (error) {
    console.error('[PaymentAudit] Failed to log payment audit:', error.message);
    return null;
  }
};

export const getPaymentAuditTrail = async (orderId) => {
  try {
    const logs = await PaymentAuditLog.find({ orderId })
      .sort({ createdAt: 1 })
      .lean();
    return logs;
  } catch (error) {
    console.error('[PaymentAudit] Failed to get audit trail:', error.message);
    return [];
  }
};

export const getUserPaymentHistory = async (userId, options = {}) => {
  try {
    const { limit = 50, page = 1 } = options;
    const skip = (page - 1) * limit;

    const logs = await PaymentAuditLog.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await PaymentAuditLog.countDocuments({ userId });

    return { logs, total, page, limit };
  } catch (error) {
    console.error('[PaymentAudit] Failed to get user payment history:', error.message);
    return { logs: [], total: 0, page: 1, limit };
  }
};
