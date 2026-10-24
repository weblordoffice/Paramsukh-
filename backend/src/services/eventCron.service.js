import cron from 'node-cron';
import { EventRegistration } from '../models/eventRegistration.models.js';
import { Event } from '../models/event.models.js';
import { cancelRegistrationWithSideEffects } from './eventRegistration.service.js';

const DEFAULT_SCHEDULE = '0 * * * *';
const DEFAULT_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/**
 * Cancel pending registrations whose payment never completed, release their
 * seats, and revert any coupon/offer ledger entries.
 */
export const expireAbandonedRegistrations = async ({ olderThanMs = DEFAULT_TIMEOUT_MS } = {}) => {
  const cutoff = new Date(Date.now() - olderThanMs);

  const pending = await EventRegistration.find({
    status: 'pending',
    updatedAt: { $lt: cutoff },
  });

  let cancelled = 0;

  for (const registration of pending) {
    try {
      const result = await cancelRegistrationWithSideEffects(registration, {
        cancelledBy: 'system',
        reason: 'Automatically cancelled due to payment timeout',
        refund: false,
      });
      if (registration.status === 'cancelled') {
        cancelled += 1;
      }
      if (result.seatReleased) {
        console.log(`[CRON] Released seat for abandoned registration ${registration._id}`);
      }
    } catch (error) {
      console.error(`[CRON] Failed to expire registration ${registration._id}:`, error.message);
    }
  }

  if (cancelled > 0) {
    console.log(`🧹 Cron: Cancelled ${cancelled} abandoned pending event registrations.`);
  }

  return { cancelled };
};

/**
 * Keep Event.status in sync with the clock (cancelled events are never touched).
 */
export const refreshEventStatuses = async () => {
  const now = new Date();

  const [pastResult, upcomingResult, ongoingResult] = await Promise.all([
    Event.updateMany(
      { status: { $ne: 'cancelled' }, endTime: { $ne: null, $lt: now } },
      { $set: { status: 'past' } }
    ),
    Event.updateMany(
      { status: { $ne: 'cancelled' }, startTime: { $gt: now } },
      { $set: { status: 'upcoming' } }
    ),
    Event.updateMany(
      {
        status: { $ne: 'cancelled' },
        startTime: { $lte: now },
        $or: [{ endTime: null }, { endTime: { $gte: now } }],
      },
      { $set: { status: 'ongoing' } }
    ),
  ]);

  return {
    past: pastResult.modifiedCount,
    upcoming: upcomingResult.modifiedCount,
    ongoing: ongoingResult.modifiedCount,
  };
};

export const setupEventCrons = () => {
  const job = cron.schedule(process.env.EVENT_CRON_SCHEDULE || DEFAULT_SCHEDULE, async () => {
    try {
      await expireAbandonedRegistrations();
      await refreshEventStatuses();
    } catch (error) {
      console.error('❌ Cron Error in Event Cleanup:', error);
    }
  });

  console.log('[CRON] Event cleanup and status refresh scheduled');
  return job;
};
