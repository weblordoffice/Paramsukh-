import cron from 'node-cron';
import { LiveCoachingSession } from '../models/liveSession.models.js';
import { LiveSessionRegistration } from '../models/liveSessionRegistration.models.js';
import Notification from '../models/notification.models.js';
import { sendPushToUser } from './pushService.js';

const HOUR_MS = 60 * 60 * 1000;

const sendReminder = async (registration, session, hoursUntil) => {
  const title = hoursUntil <= 1
    ? `Starting soon: ${session.title}`
    : `Tomorrow: ${session.title}`;
  const message = hoursUntil <= 1
    ? `Your live session "${session.title}" starts in less than an hour.`
    : `Your live session "${session.title}" starts in less than 24 hours.`;

  await Notification.createNotification({
    user: registration.userId,
    type: 'live_session_reminder',
    title,
    message,
    relatedId: session._id,
    actionUrl: '/(home)/live-sessions',
    icon: '⏰',
  });

  await sendPushToUser(registration.userId, {
    title,
    body: message,
    data: {
      type: 'live_session_reminder',
      actionUrl: '/(home)/live-sessions',
      sessionId: String(session._id),
    },
  });
};

export const sendLiveSessionReminders = async () => {
  const now = Date.now();
  const windowEnd = new Date(now + 25 * HOUR_MS);

  const sessions = await LiveCoachingSession.find({
    status: 'scheduled',
    scheduledAt: { $gte: new Date(now), $lte: windowEnd },
  }).lean();

  if (sessions.length === 0) return { sent: 0 };

  const sessionById = new Map(sessions.map((session) => [String(session._id), session]));
  const registrations = await LiveSessionRegistration.find({
    sessionId: { $in: sessions.map((session) => session._id) },
    status: 'registered',
    $or: [
      { reminder24SentAt: null },
      { reminder1SentAt: null },
    ],
  }).lean();

  let sent = 0;

  for (const registration of registrations) {
    const session = sessionById.get(String(registration.sessionId));
    if (!session) continue;

    const startTime = new Date(session.scheduledAt).getTime();
    const hoursUntil = (startTime - now) / HOUR_MS;

    if (hoursUntil <= 0) continue;

    if (hoursUntil <= 1 && !registration.reminder1SentAt) {
      try {
        await sendReminder(registration, session, hoursUntil);
        await LiveSessionRegistration.updateOne(
          { _id: registration._id },
          { $set: { reminder1SentAt: new Date(), reminder24SentAt: registration.reminder24SentAt || new Date() } }
        );
        sent += 1;
      } catch (error) {
        console.error('Live session 1h reminder failed:', error?.message);
      }
      continue;
    }

    if (hoursUntil <= 24 && !registration.reminder24SentAt) {
      try {
        await sendReminder(registration, session, hoursUntil);
        await LiveSessionRegistration.updateOne(
          { _id: registration._id },
          { $set: { reminder24SentAt: new Date() } }
        );
        sent += 1;
      } catch (error) {
        console.error('Live session 24h reminder failed:', error?.message);
      }
    }
  }

  return { sent };
};

export const setupLiveSessionCrons = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await sendLiveSessionReminders();
      if (result.sent > 0) {
        console.log(`[CRON] Live session reminders sent: ${result.sent}`);
      }
    } catch (error) {
      console.error('[CRON] Live session reminders failed:', error.message);
    }
  });

  console.log('[CRON] Live session reminders scheduled every 15 minutes');
};
