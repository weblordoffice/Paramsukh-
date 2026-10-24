import Coupon from '../models/coupon.models.js';
import { sendBulkNotifications } from '../controller/notifications/notifications.controller.js';

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const discountLabel = (coupon) => {
  if (coupon.discountType === 'percentage') {
    const cap = coupon.maxDiscount ? ` up to ₹${coupon.maxDiscount}` : '';
    return `${coupon.discountValue}% off${cap}`;
  }
  return `₹${coupon.discountValue} off`;
};

/**
 * Push a coupon to its assigned users. Idempotent per user via `notifiedUsers`,
 * so re-saving a coupon only announces it to newly added users.
 */
export const notifyCouponRecipients = async (coupon) => {
  if (!coupon) return { notified: 0 };

  const now = new Date();
  if (!coupon.isActive) return { notified: 0 };
  if (coupon.startDate && new Date(coupon.startDate) > now) return { notified: 0 };
  if (coupon.endDate && new Date(coupon.endDate) < now) return { notified: 0 };
  if (coupon.userRestriction !== 'specific') return { notified: 0 };

  const assigned = (coupon.applicableUsers || []).map(String);
  const alreadyNotified = new Set((coupon.notifiedUsers || []).map(String));
  const pending = assigned.filter((userId) => !alreadyNotified.has(userId));
  if (pending.length === 0) return { notified: 0 };

  const minimum = Number(coupon.minOrderValue || 0) > 0
    ? ` Min order ₹${coupon.minOrderValue}.`
    : '';

  await sendBulkNotifications(pending, {
    type: 'coupon',
    title: `New coupon: ${coupon.code}`,
    message: `${discountLabel(coupon)} — ${coupon.description}.${minimum} Valid till ${formatDate(coupon.endDate)}.`,
    relatedId: coupon._id,
    relatedType: 'coupon',
    actionUrl: '/(home)/my-coupons',
    icon: '🎟️',
    priority: 'high',
  });

  await Coupon.updateOne(
    { _id: coupon._id },
    { $addToSet: { notifiedUsers: { $each: pending } } }
  );

  return { notified: pending.length };
};
