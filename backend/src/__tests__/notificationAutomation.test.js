import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { User } from '../models/user.models.js';
import { Course } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import Assessment from '../models/assessment.models.js';
import { WellnessGoal } from '../models/wellnessGoal.models.js';
import Notification from '../models/notification.models.js';
import { Event } from '../models/event.models.js';
import { EventRegistration } from '../models/eventRegistration.models.js';
import {
  notifyNewCourse,
  notifyCourseContentAdded,
  sendDailyMotivationQuotes,
} from '../services/notificationAutomation.service.js';
import { sendEventReminders } from '../services/eventReminder.service.js';

setupDB();

const app = createTestApp();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

const createUser = async (overrides = {}) => User.create({
  phone: `+91${uid()}`,
  displayName: 'Notify User',
  email: `${uid()}@test.com`,
  authProvider: 'phone',
  ...overrides,
});

describe('Module 13 - notification automation', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Course.deleteMany({});
    await Enrollment.deleteMany({});
    await Assessment.deleteMany({});
    await WellnessGoal.deleteMany({});
    await Notification.deleteMany({});
  });

  it('sends the daily motivation quote only once per day and respects preferences', async () => {
    const enabled = await createUser();
    await createUser({ preferences: { notifications: false } });

    const first = await sendDailyMotivationQuotes();
    expect(first.sent).toBe(1);

    const notifications = await Notification.find({ user: enabled._id, type: 'daily_motivation' });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('Daily Motivation');

    const second = await sendDailyMotivationQuotes();
    expect(second.sent).toBe(0);
  });

  it('targets new course announcements to users with matching wellness interests', async () => {
    const mentalGoalUser = await createUser();
    const physicalGoalUser = await createUser();
    const assessmentUser = await createUser();

    await WellnessGoal.create({
      userId: mentalGoalUser._id,
      title: 'Reduce stress',
      category: 'mental',
      targetValue: 10,
    });
    await WellnessGoal.create({
      userId: physicalGoalUser._id,
      title: 'Run a 5k',
      category: 'physical',
      targetValue: 5,
    });
    await Assessment.create({
      user: assessmentUser._id,
      occupation: 'Engineer',
      location: 'Delhi',
      physicalIssue: false,
      specialDiseaseIssue: false,
      relationshipIssue: false,
      financialIssue: false,
      mentalHealthIssue: true,
      spiritualGrowth: false,
    });

    const course = await Course.create({
      title: 'Mindful Living',
      description: 'A course for a calmer mind',
      duration: '4 weeks',
      category: 'mental wellness',
      status: 'published',
      videos: [],
      pdfs: [],
    });

    const recipients = await notifyNewCourse(course);
    expect(recipients).toBe(2);

    const notifiedIds = (await Notification.find({ type: 'course_update' }).distinct('user')).map(String);
    expect(notifiedIds).toContain(String(mentalGoalUser._id));
    expect(notifiedIds).toContain(String(assessmentUser._id));
    expect(notifiedIds).not.toContain(String(physicalGoalUser._id));
  });

  it('notifies enrolled users when new content is added to a course', async () => {
    const enrolled = await createUser();
    const other = await createUser();

    const course = await Course.create({
      title: 'Yoga Basics',
      description: 'Foundational yoga',
      duration: '2 weeks',
      category: 'physical',
      status: 'published',
      videos: [],
      pdfs: [],
    });

    await Enrollment.create({ userId: enrolled._id, courseId: course._id });
    await Enrollment.create({
      userId: other._id,
      courseId: new mongoose.Types.ObjectId(),
    });

    const recipients = await notifyCourseContentAdded(course, 'video', 'Morning Flow');
    expect(recipients).toBe(1);

    const notifications = await Notification.find({ type: 'course_update' });
    expect(notifications).toHaveLength(1);
    expect(String(notifications[0].user)).toBe(String(enrolled._id));
    expect(notifications[0].message).toContain('Morning Flow');
  });
});

describe('Module 6 - event reminders and calendar', () => {
  beforeEach(async () => {
    await Event.deleteMany({});
    await EventRegistration.deleteMany({});
    await Notification.deleteMany({});
  });

  const createEvent = async (hoursFromNow) => Event.create({
    title: 'Wellness Workshop',
    description: 'A hands-on workshop',
    eventDate: new Date(Date.now() + hoursFromNow * 60 * 60 * 1000),
    eventTime: '10:00 AM',
    startTime: new Date(Date.now() + hoursFromNow * 60 * 60 * 1000),
    location: 'Pune',
    category: 'Wellness',
    status: 'upcoming',
    notificationEnabled: true,
  });

  it('sends a 24-hour reminder and records it on the registration', async () => {
    const event = await createEvent(20);
    const userId = new mongoose.Types.ObjectId();
    const registration = await EventRegistration.create({
      userId,
      eventId: event._id,
      status: 'confirmed',
    });

    const result = await sendEventReminders();
    expect(result.sent).toBe(1);

    const notification = await Notification.findOne({ user: userId, type: 'event_reminder' });
    expect(notification).not.toBeNull();
    expect(notification.title).toContain('Tomorrow');

    const refreshed = await EventRegistration.findById(registration._id);
    expect(refreshed.reminder24SentAt).toBeTruthy();
    expect(refreshed.reminder1SentAt).toBeFalsy();

    const second = await sendEventReminders();
    expect(second.sent).toBe(0);
  });

  it('sends a 1-hour reminder for imminent events', async () => {
    const event = await createEvent(0.5);
    const userId = new mongoose.Types.ObjectId();
    await EventRegistration.create({
      userId,
      eventId: event._id,
      status: 'confirmed',
    });

    const result = await sendEventReminders();
    expect(result.sent).toBe(1);

    const notification = await Notification.findOne({ user: userId, type: 'event_reminder' });
    expect(notification).not.toBeNull();
    expect(notification.title).toContain('Starting soon');
  });

  it('serves an ICS calendar file for an event', async () => {
    const event = await createEvent(24);

    const res = await request(app).get(`/api/events/${event._id}/calendar.ics`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text).toContain('BEGIN:VCALENDAR');
    expect(res.text).toContain('SUMMARY:Wellness Workshop');
    expect(res.text).toContain(`UID:${event._id}@paramsukh`);
  });
});
