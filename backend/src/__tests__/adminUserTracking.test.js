import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { User } from '../models/user.models.js';
import { Course } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import Certificate from '../models/certificate.models.js';
import { WellnessGoal } from '../models/wellnessGoal.models.js';
import { createTestUser, getAdminApiKeyHeader } from './helpers.js';

setupDB();

const app = createTestApp();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
const daysAgo = (days) => new Date(Date.now() - days * 86400000);

describe('Admin user tracking', () => {
  it('should return per-user analytics, risk flags, achievements, and activity timeline', async () => {
    const user = await createTestUser({
      phone: `+91${uid()}`,
      email: `tracked-${uid()}@test.com`,
      displayName: 'Tracked User',
      subscriptionPlan: 'gold',
      subscriptionStatus: 'active',
    });

    const course = await Course.create({
      title: 'Tracked Course',
      description: 'Course for tracking',
      category: 'Mental Wellness',
      duration: '2 hours',
      videos: [{ title: 'Intro', videoUrl: 'http://test.com/1', duration: 120, order: 1 }],
      pdfs: [],
    });

    await Enrollment.create({
      userId: user._id,
      courseId: course._id,
      progress: 35,
      lastAccessedAt: daysAgo(20),
      enrolledAt: daysAgo(40),
    });

    await WellnessGoal.create({
      userId: user._id,
      title: 'Tracked goal',
      category: 'mental',
      targetValue: 10,
      currentValue: 3,
      unit: 'days',
      status: 'active',
      targetDate: daysAgo(2),
    });

    await Certificate.create({
      certificateId: `TRACK-${uid()}`,
      user: user._id,
      course: course._id,
      issuedTo: user.displayName,
      courseName: course.title,
    });

    const analytics = await request(app)
      .get(`/api/user/${user._id}/analytics/admin?range=30`)
      .set(getAdminApiKeyHeader());

    expect(analytics.status).toBe(200);
    expect(analytics.body.success).toBe(true);
    expect(analytics.body.profile.email).toContain('tracked-');
    expect(analytics.body.learning.totalEnrollments).toBe(1);
    expect(Array.isArray(analytics.body.achievements)).toBe(true);
    expect(analytics.body.risk).toBeTruthy();
    expect(analytics.body.risk.lastActivityAt).toBeTruthy();
    expect(analytics.body.risk.flags).toContain('stalled_courses');
    expect(analytics.body.risk.flags).toContain('overdue_goals');

    const activity = await request(app)
      .get(`/api/user/${user._id}/activity?range=90`)
      .set(getAdminApiKeyHeader());

    expect(activity.status).toBe(200);
    expect(activity.body.success).toBe(true);
    expect(activity.body.activities.some((item) => item.type === 'course_enrolled')).toBe(true);
    expect(activity.body.activities.some((item) => item.type === 'goal_created')).toBe(true);
    expect(activity.body.activities.some((item) => item.type === 'certificate_issued')).toBe(true);
  });

  it('should surface inactive users in the attention dashboard', async () => {
    const activeUser = await createTestUser({
      phone: `+91${uid()}`,
      email: `active-${uid()}@test.com`,
      displayName: 'Active User',
    });

    const inactiveUser = await createTestUser({
      phone: `+91${uid()}`,
      email: `inactive-${uid()}@test.com`,
      displayName: 'Inactive User',
    });

    await User.updateOne(
      { _id: inactiveUser._id },
      { $set: { lastLoginAt: daysAgo(45) } }
    );

    const course = await Course.create({
      title: 'Inactive Course',
      description: 'Course for inactive tracking',
      category: 'Mental Wellness',
      duration: '2 hours',
      videos: [{ title: 'Intro', videoUrl: 'http://test.com/1', duration: 120, order: 1 }],
      pdfs: [],
    });

    await Enrollment.create({
      userId: inactiveUser._id,
      courseId: course._id,
      progress: 10,
      lastAccessedAt: daysAgo(45),
      enrolledAt: daysAgo(60),
    });

    const activeEnrollment = await Course.create({
      title: 'Fresh Course',
      description: 'Course for active tracking',
      category: 'Mental Wellness',
      duration: '1 hour',
      videos: [{ title: 'Intro', videoUrl: 'http://test.com/2', duration: 60, order: 1 }],
      pdfs: [],
    });

    await Enrollment.create({
      userId: activeUser._id,
      courseId: activeEnrollment._id,
      progress: 50,
      lastAccessedAt: new Date(),
      enrolledAt: daysAgo(2),
    });

    const res = await request(app)
      .get('/api/user/analytics/admin/attention')
      .set(getAdminApiKeyHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.counts.total).toBeGreaterThanOrEqual(2);
    expect(res.body.counts.inactive).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.users)).toBe(true);

    const inactiveSummary = res.body.users.find((item) => String(item.userId) === String(inactiveUser._id));
    expect(inactiveSummary).toBeTruthy();
    expect(inactiveSummary.riskStatus).toBe('inactive');
    expect(inactiveSummary.flags).toContain('inactive_30d');

    const topInactive = res.body.top.find((item) => String(item.userId) === String(inactiveUser._id));
    expect(topInactive).toBeTruthy();
  });
});
