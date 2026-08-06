import cron from 'node-cron';
import { EventRegistration } from '../models/eventRegistration.models.js';
import { Event } from '../models/event.models.js';

const DEFAULT_SCHEDULE = '0 * * * *';

export const setupEventCrons = () => {
  // Run every hour to clean up pending registrations older than 2 hours
  const job = cron.schedule(process.env.EVENT_CRON_SCHEDULE || DEFAULT_SCHEDULE, async () => {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      // Find pending registrations that will be cancelled
      const pending = await EventRegistration.find({
        status: 'pending',
        registeredAt: { $lt: twoHoursAgo }
      }).select('eventId');

      if (pending.length === 0) return;

      const result = await EventRegistration.updateMany({
        _id: { $in: pending.map(r => r._id) },
        status: 'pending',
        registeredAt: { $lt: twoHoursAgo }
      }, {
        $set: { status: 'cancelled', notes: 'Automatically marked cancelled due to payment timeout' }
      });

      if (result.modifiedCount > 0) {
        console.log(`🧹 Cron: Cancelled ${result.modifiedCount} abandoned pending event registrations.`);

        // Release reserved seats per event
        const eventCounts = {};
        for (const reg of pending) {
          const eid = reg.eventId.toString();
          eventCounts[eid] = (eventCounts[eid] || 0) + 1;
        }
        for (const [eventId, count] of Object.entries(eventCounts)) {
          await Event.findByIdAndUpdate(eventId, { $inc: { reservedSeats: -count } });
        }
        console.log(`🧹 Cron: Released reserved seats for ${Object.keys(eventCounts).length} event(s).`);
      }
    } catch (error) {
      console.error('❌ Cron Error in Event Cleanup:', error);
    }
  });

  return job;
};
