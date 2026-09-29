import PaymentAuditLog from '../models/paymentAuditLog.models.js';
import Order from '../models/order.models.js';
import User from '../models/user.models.js';
import { sendNotification } from '../controller/notifications/notifications.controller.js';

export const ANOMALY_TYPES = {
  HIGH_FAILURE_RATE: 'high_failure_rate',
  RAPID_RETRY: 'rapid_retry',
  UNUSUAL_AMOUNT: 'unusual_amount',
  MULTIPLE_PAYMENT_ATTEMPTS: 'multiple_payment_attempts',
  GEO_ANOMALY: 'geo_anomaly',
  SUSPICIOUS_PATTERN: 'suspicious_pattern',
};

export const ANOMALY_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

class PaymentAnomalyMonitor {
  constructor() {
    this.failedPaymentWindow = 3600000;
    this.maxFailedAttemptsPerHour = 5;
    this.maxPaymentsPerMinute = 3;
    this.alertCooldown = 3600000;
    this.lastAlertTime = {};
  }

  async checkAnomalies(userId, paymentData = {}) {
    const anomalies = [];

    const highFailureRate = await this.checkHighFailureRate(userId);
    if (highFailureRate) anomalies.push(highFailureRate);

    const rapidRetry = await this.checkRapidRetryAttempts(userId);
    if (rapidRetry) anomalies.push(rapidRetry);

    const unusualAmount = await this.checkUnusualAmount(userId, paymentData.amount);
    if (unusualAmount) anomalies.push(unusualAmount);

    const multipleAttempts = await this.checkMultiplePaymentAttempts(userId);
    if (multipleAttempts) anomalies.push(multipleAttempts);

    return anomalies;
  }

  async checkHighFailureRate(userId) {
    const oneHourAgo = new Date(Date.now() - this.failedPaymentWindow);

    const failedCount = await PaymentAuditLog.countDocuments({
      userId,
      action: 'payment_failed',
      createdAt: { $gte: oneHourAgo },
    });

    const totalCount = await PaymentAuditLog.countDocuments({
      userId,
      action: { $in: ['payment_initiated', 'payment_failed'] },
      createdAt: { $gte: oneHourAgo },
    });

    if (totalCount === 0) return null;

    const failureRate = failedCount / totalCount;

    if (failureRate > 0.5 && failedCount >= 3) {
      return {
        type: ANOMALY_TYPES.HIGH_FAILURE_RATE,
        severity: failureRate > 0.8 ? ANOMALY_SEVERITY.HIGH : ANOMALY_SEVERITY.MEDIUM,
        message: `User has ${failureRate * 100}% payment failure rate (${failedCount}/${totalCount})`,
        metadata: { failureRate, failedCount, totalCount },
      };
    }

    return null;
  }

  async checkRapidRetryAttempts(userId) {
    const oneMinuteAgo = new Date(Date.now() - 60000);

    const recentAttempts = await PaymentAuditLog.countDocuments({
      userId,
      action: { $in: ['payment_initiated', 'payment_verified', 'payment_failed'] },
      createdAt: { $gte: oneMinuteAgo },
    });

    if (recentAttempts > this.maxPaymentsPerMinute) {
      return {
        type: ANOMALY_TYPES.RAPID_RETRY,
        severity: recentAttempts > 10 ? ANOMALY_SEVERITY.HIGH : ANOMALY_SEVERITY.MEDIUM,
        message: `User attempted ${recentAttempts} payment operations in the last minute`,
        metadata: { attemptCount: recentAttempts },
      };
    }

    return null;
  }

  async checkUnusualAmount(userId, amount) {
    if (!amount || amount <= 0) return null;

    const user = await User.findById(userId).select('referralPoints');
    if (!user) return null;

    const avgOrderValue = 500;
    const maxThreshold = avgOrderValue * 10;

    if (amount > maxThreshold) {
      return {
        type: ANOMALY_TYPES.UNUSUAL_AMOUNT,
        severity: amount > maxThreshold * 5 ? ANOMALY_SEVERITY.HIGH : ANOMALY_SEVERITY.MEDIUM,
        message: `Unusually large payment amount: ₹${amount}`,
        metadata: { amount, threshold: maxThreshold },
      };
    }

    return null;
  }

  async checkMultiplePaymentAttempts(userId) {
    const recentPayments = await PaymentAuditLog.find({
      userId,
      action: 'payment_verified',
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (recentPayments.length < 5) return null;

    const timestamps = recentPayments.map((p) => p.createdAt.getTime());
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    if (avgInterval < 300000) {
      return {
        type: ANOMALY_TYPES.MULTIPLE_PAYMENT_ATTEMPTS,
        severity: avgInterval < 60000 ? ANOMALY_SEVERITY.HIGH : ANOMALY_SEVERITY.MEDIUM,
        message: `User is making very frequent payments (avg ${Math.round(avgInterval / 1000)}s between payments)`,
        metadata: { avgIntervalSeconds: Math.round(avgInterval / 1000) },
      };
    }

    return null;
  }

  async handleAnomaly(anomaly, userId) {
    const alertKey = `${anomaly.type}_${userId}`;
    const now = Date.now();

    if (this.lastAlertTime[alertKey] && now - this.lastAlertTime[alertKey] < this.alertCooldown) {
      return;
    }

    this.lastAlertTime[alertKey] = now;

    console.warn(`[AnomalyMonitor] ${anomaly.severity.toUpperCase()}: ${anomaly.message}`, {
      type: anomaly.type,
      userId,
      metadata: anomaly.metadata,
    });

    if (anomaly.severity === ANOMALY_SEVERITY.HIGH || anomaly.severity === ANOMALY_SEVERITY.CRITICAL) {
      try {
        const admins = await User.find({ role: 'admin' }).limit(5);
        for (const admin of admins) {
          await sendNotification(admin._id, {
            type: 'security',
            title: `Payment Anomaly: ${anomaly.type}`,
            message: anomaly.message,
            icon: '⚠️',
            priority: 'high',
            metadata: { userId, anomaly },
          });
        }
      } catch (err) {
        console.error('[AnomalyMonitor] Failed to alert admins:', err.message);
      }
    }
  }
}

export const anomalyMonitor = new PaymentAnomalyMonitor();

export const checkPaymentAnomalies = async (userId, paymentData) => {
  const anomalies = await anomalyMonitor.checkAnomalies(userId, paymentData);

  for (const anomaly of anomalies) {
    await anomalyMonitor.handleAnomaly(anomaly, userId);
  }

  return anomalies;
};
