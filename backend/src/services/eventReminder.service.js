import cron from 'node-cron';
import { Event } from '../models/event.models.js';
import { EventRegistration } from '../models/eventRegistration.models.js';
import Notification from '../models/notification.models.js';
import { sendPushToUser } from './pushService.js';

const HOUR_MS = 60 * 60 * 1000;

const sendReminder = async (registration, event, hoursUntil) => {
  const title = hoursUntil <= 1
    ? `Starting soon: ${event.title}`
    : `Tomorrow: ${event.title}`;
  const message = hoursUntil <= 1
    ? `Your event "${event.title}" starts in less than an hour.`
    : `Your event "${event.title}" starts in less than 24 hours.`;

  await Notification.createNotification({
    user: registration.userId,
    type: 'event_reminder',
    title,
    message,
    relatedId: event._id,
    relatedType: 'event',
    actionUrl: `/event-detail?eventId=${event._id}`,
    icon: event.emoji || '📅',
  });

  await sendPushToUser(registration.userId, {
    title,
    body: message,
    data: {
      type: 'event_reminder',
      relatedId: String(event._id),
      relatedType: 'event',
      actionUrl: `/event-detail?eventId=${event._id}`,
      eventId: String(event._id),
    },
  });
};

export const sendEventReminders = async () => {
  const now = Date.now();
  const windowEnd = new Date(now + 25 * HOUR_MS);

  const events = await Event.find({
    isActive: true,
    status: { $in: ['upcoming', 'ongoing'] },
    notificationEnabled: { $ne: false },
    startTime: { $gte: new Date(now), $lte: windowEnd },
  }).lean();

  if (events.length === 0) return { sent: 0 };

  const eventById = new Map(events.map((event) => [String(event._id), event]));
  const registrations = await EventRegistration.find({
    eventId: { $in: events.map((event) => event._id) },
    status: 'confirmed',
    $or: [
      { reminder24SentAt: null },
      { reminder1SentAt: null },
    ],
  }).lean();

  let sent = 0;

  for (const registration of registrations) {
    const event = eventById.get(String(registration.eventId));
    if (!event) continue;

    const startTime = new Date(event.startTime).getTime();
    const hoursUntil = (startTime - now) / HOUR_MS;

    if (hoursUntil <= 0) continue;

    if (hoursUntil <= 1 && !registration.reminder1SentAt) {
      // Claim atomically before sending so overlapping runs cannot double-send.
      const claimed = await EventRegistration.findOneAndUpdate(
        { _id: registration._id, reminder1SentAt: null },
        { $set: { reminder1SentAt: new Date() } },
        { new: true }
      );
      if (!claimed) continue;

      try {
        await sendReminder(registration, event, hoursUntil);
        await EventRegistration.updateOne(
          { _id: registration._id },
          { $set: { reminder24SentAt: claimed.reminder24SentAt || new Date() } }
        );
        sent += 1;
      } catch (error) {
        await EventRegistration.updateOne(
          { _id: registration._id },
          { $set: { reminder1SentAt: null } }
        );
        console.error('Event 1h reminder failed:', error?.message);
      }
      continue;
    }

    if (hoursUntil <= 24 && !registration.reminder24SentAt) {
      const claimed = await EventRegistration.findOneAndUpdate(
        { _id: registration._id, reminder24SentAt: null },
        { $set: { reminder24SentAt: new Date() } },
        { new: true }
      );
      if (!claimed) continue;

      try {
        await sendReminder(registration, event, hoursUntil);
        sent += 1;
      } catch (error) {
        await EventRegistration.updateOne(
          { _id: registration._id },
          { $set: { reminder24SentAt: null } }
        );
        console.error('Event 24h reminder failed:', error?.message);
      }
    }
  }

  return { sent };
};

export const setupEventReminderCrons = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await sendEventReminders();
      if (result.sent > 0) {
        console.log(`[CRON] Event reminders sent: ${result.sent}`);
      }
    } catch (error) {
      console.error('[CRON] Event reminders failed:', error.message);
    }
  });

  console.log('[CRON] Event reminders scheduled every 15 minutes');
};
