import cron from 'node-cron';
import { VivaApplication } from '../models/vivaApplication.models.js';
import { Course } from '../models/course.models.js';
import Notification from '../models/notification.models.js';
import { sendPushToUser } from './pushService.js';

const sendReminder = async (viva, windowLabel, flag) => {
  try {
    const course = await Course.findById(viva.course).select('title').lean();
    const courseId = String(viva.course);
    const courseTitle = course?.title || 'your course';
    const when = new Date(viva.scheduledAt).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    });
    const actionUrl = `/course-assessment?courseId=${courseId}&courseTitle=${encodeURIComponent(courseTitle)}`;
    const message = `Your viva for ${courseTitle} starts in ${windowLabel} (${when}).${viva.meetingLink ? ` Join: ${viva.meetingLink}` : ''}`;

    await Notification.createNotification({
      user: viva.user,
      type: 'viva_reminder',
      title: `Viva reminder — ${windowLabel} to go`,
      message,
      relatedId: viva._id,
      relatedType: 'course',
      actionUrl,
      icon: '⏰',
    });
    await sendPushToUser(viva.user, {
      title: `Viva reminder — ${windowLabel} to go`,
      body: message,
      data: {
        type: 'viva_reminder',
        actionUrl,
        relatedId: String(viva._id),
      },
    });

    await VivaApplication.updateOne(
      { _id: viva._id },
      { $set: { [flag]: new Date() } }
    );
    return 1;
  } catch (error) {
    console.error('Viva reminder failed:', error?.message);
    return 0;
  }
};

export const sendVivaReminders = async () => {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [dayWindow, hourWindow] = await Promise.all([
    VivaApplication.find({
      status: 'scheduled',
      scheduledAt: { $gt: inOneHour, $lte: inOneDay },
      $or: [
        { reminder24SentAt: null },
        { reminder24SentAt: { $exists: false } },
      ],
    }).lean(),
    VivaApplication.find({
      status: 'scheduled',
      scheduledAt: { $gt: now, $lte: inOneHour },
      $or: [
        { reminder1SentAt: null },
        { reminder1SentAt: { $exists: false } },
      ],
    }).lean(),
  ]);

  let sent = 0;
  for (const viva of dayWindow) {
    sent += await sendReminder(viva, '24 hours', 'reminder24SentAt');
  }
  for (const viva of hourWindow) {
    sent += await sendReminder(viva, '1 hour', 'reminder1SentAt');
  }

  return { sent };
};

export const setupVivaReminderCrons = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await sendVivaReminders();
      if (result.sent > 0) {
        console.log(`[CRON] Viva reminders sent: ${result.sent}`);
      }
    } catch (error) {
      console.error('[CRON] Viva reminder job failed:', error?.message);
    }
  });
};
