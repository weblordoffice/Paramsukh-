import cron from 'node-cron';
import { EventRegistration } from '../../models/eventRegistration.models.js';

export const setupEventCrons = () => {
  // Run every hour to clean up pending registrations older than 2 hours
  cron.schedule('0 * * * *', async () => {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      const result = await EventRegistration.updateMany({
        status: 'pending',
        registeredAt: { $lt: twoHoursAgo }
      }, {
        $set: { status: 'cancelled', notes: 'Automatically marked cancelled due to payment timeout' }
      });

      if (result.modifiedCount > 0) {
        console.log(`🧹 Cron: Cancelled ${result.modifiedCount} abandoned pending event registrations.`);
      }
    } catch (error) {
      console.error('❌ Cron Error in Event Cleanup:', error);
    }
  });
};
