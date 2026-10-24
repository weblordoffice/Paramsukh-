import { Event } from '../models/event.models.js';
import { EventRegistration } from '../models/eventRegistration.models.js';
import { revertPurchaseDiscount } from './purchaseDiscount.service.js';
import { createRefund } from './razorpayService.js';

/**
 * Reserve one seat and mark the registration as holding it.
 * Returns the updated event, or null when the event is full.
 */
export const reserveSeat = async (eventId, registration) => {
  const event = await Event.findOneAndUpdate(
    {
      _id: eventId,
      $or: [
        { maxAttendees: null },
        {
          $expr: {
            $lt: [
              {
                $add: [
                  { $ifNull: ['$currentAttendees', 0] },
                  { $ifNull: ['$reservedSeats', 0] },
                ],
              },
              '$maxAttendees',
            ],
          },
        },
      ],
    },
    { $inc: { reservedSeats: 1 } },
    { new: true }
  );

  if (!event) return null;

  await EventRegistration.updateOne(
    { _id: registration._id, seatReserved: { $ne: true } },
    { $set: { seatReserved: true } }
  );
  registration.seatReserved = true;

  return event;
};

/**
 * Release a held seat exactly once. Claims the registration flag atomically so
 * concurrent confirms/cancels cannot decrement twice or drive the counter below 0.
 */
export const releaseSeat = async (registration) => {
  if (!registration?._id) return false;

  const claimed = await EventRegistration.findOneAndUpdate(
    { _id: registration._id, seatReserved: true },
    { $set: { seatReserved: false } },
    { new: true }
  );

  registration.seatReserved = false;
  if (!claimed) return false;

  await Event.findOneAndUpdate(
    { _id: claimed.eventId, reservedSeats: { $gt: 0 } },
    { $inc: { reservedSeats: -1 } }
  );

  return true;
};

export const ensureTicketId = async (registration) =>
  EventRegistration.ensureTicketId(registration);

export const revertDiscountForRegistration = async (registration) => {
  if (!registration?._id) return null;
  return revertPurchaseDiscount({
    providerOrderId: registration.razorpayOrderId || null,
    providerPaymentLinkId: registration.paymentLinkId || null,
    referenceType: 'event',
    referenceId: registration._id,
  });
};

/**
 * Refund a paid registration. `createRefund` expects rupees.
 * Mutates the registration; the caller saves it.
 */
export const refundEventRegistration = async (registration, { reason = 'Event cancellation' } = {}) => {
  if (!registration) return { status: null };
  if (registration.refundStatus === 'processed' || registration.refundStatus === 'pending') {
    return { status: registration.refundStatus };
  }
  if (
    registration.paymentStatus !== 'completed'
    || !registration.paymentId
    || Number(registration.paymentAmount || 0) <= 0
  ) {
    return { status: null };
  }

  try {
    const refund = await createRefund(
      registration.paymentId,
      Number(registration.paymentAmount),
      {
        type: 'event',
        eventId: String(registration.eventId),
        registrationId: String(registration._id),
        userId: String(registration.userId),
        reason,
      }
    );

    registration.refundId = refund.id;
    registration.refundAmount = Number(registration.paymentAmount);
    registration.refundStatus = 'processed';
    registration.refundProcessedAt = new Date();
    registration.refundError = null;
    registration.paymentStatus = 'refunded';

    return { status: 'processed', refund };
  } catch (error) {
    registration.refundStatus = 'failed';
    registration.refundError = error.message;
    return { status: 'failed', error: error.message };
  }
};

/**
 * Apply a cancellation consistently: free the seat, fail pending payments,
 * optionally refund, and revert the coupon/offer ledger entry.
 */
export const cancelRegistrationWithSideEffects = async (
  registration,
  { cancelledBy = 'user', reason = '', refund = false } = {}
) => {
  if (!registration) return { refund: null, seatReleased: false };

  const seatReleased = await releaseSeat(registration);

  registration.status = 'cancelled';
  registration.cancelledAt = new Date();
  registration.cancelledBy = cancelledBy;
  registration.cancellationReason = reason || null;
  registration.checkedIn = false;
  registration.checkedInAt = null;

  if (registration.paymentStatus === 'pending') {
    registration.paymentStatus = 'failed';
    registration.paymentId = null;
    registration.paidAt = null;
  }

  const refundResult = refund
    ? await refundEventRegistration(registration, { reason })
    : null;

  await revertDiscountForRegistration(registration);
  await registration.save();

  return { refund: refundResult, seatReleased };
};
