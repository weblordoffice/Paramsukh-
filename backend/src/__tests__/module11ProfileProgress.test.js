import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { User } from '../models/user.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { Course } from '../models/course.models.js';
import Assessment from '../models/assessment.models.js';
import Certificate from '../models/certificate.models.js';
import { EventRegistration } from '../models/eventRegistration.models.js';
import { WellnessGoal } from '../models/wellnessGoal.models.js';
import { createTestUser, createTestUser2, createTestDeviceSession, generateUserToken, getAuthHeader } from './helpers.js';

setupDB();

const app = createTestApp();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

const futureDate = () => new Date(Date.now() + 30 * 86400000).toISOString();

describe('Module 11 - Profile & Progress hardening', () => {
  let user;
  let token;

  beforeEach(async () => {
    await WellnessGoal.deleteMany({});
    await Enrollment.deleteMany({});
    await Certificate.deleteMany({});
    await Assessment.deleteMany({});
    await EventRegistration.deleteMany({});
    await Course.deleteMany({});

    user = await createTestUser({
      phone: `+91${uid()}`,
      email: `${uid()}@test.com`,
      displayName: 'Progress Tester',
    });
    token = generateUserToken(user._id);
  });

  it('should create, track, complete, update, and delete wellness goals', async () => {
    const created = await request(app)
      .post('/api/wellness-goals')
      .set(getAuthHeader(token))
      .send({
        title: 'Meditate for 30 days',
        description: 'Build a daily meditation habit',
        category: 'mental',
        targetValue: 30,
        currentValue: 0,
        unit: 'days',
        targetDate: futureDate(),
      });

    expect(created.status).toBe(201);
    expect(created.body.goal.title).toBe('Meditate for 30 days');
    expect(created.body.goal.progressPercent).toBe(0);

    const goalId = created.body.goal._id;

    const listed = await request(app)
      .get('/api/wellness-goals')
      .set(getAuthHeader(token));

    expect(listed.status).toBe(200);
    expect(listed.body.goals).toHaveLength(1);

    const progressed = await request(app)
      .patch(`/api/wellness-goals/${goalId}/progress`)
      .set(getAuthHeader(token))
      .send({ currentValue: 30 });

    expect(progressed.status).toBe(200);
    expect(progressed.body.goal.progressPercent).toBe(100);
    expect(progressed.body.goal.status).toBe('completed');

    const updated = await request(app)
      .patch(`/api/wellness-goals/${goalId}`)
      .set(getAuthHeader(token))
      .send({ title: 'Meditate consistently', status: 'active' });

    expect(updated.status).toBe(200);
    expect(updated.body.goal.title).toBe('Meditate consistently');
    expect(updated.body.goal.status).toBe('active');

    const removed = await request(app)
      .delete(`/api/wellness-goals/${goalId}`)
      .set(getAuthHeader(token));
    expect(removed.status).toBe(200);

    const dbGoal = await WellnessGoal.findById(goalId).lean();
    expect(dbGoal).toBeFalsy();
  });

  it('should isolate wellness goals between users', async () => {
    await request(app)
      .post('/api/wellness-goals')
      .set(getAuthHeader(token))
      .send({ title: 'My private goal', targetValue: 10, unit: 'days' });

    const other = await createTestUser2({ email: `other-${uid()}@test.com` });
    await createTestDeviceSession(other._id);
    const otherToken = generateUserToken(other._id);

    const res = await request(app)
      .get('/api/wellness-goals')
      .set(getAuthHeader(otherToken));

    expect(res.status).toBe(200);
    expect(res.body.goals).toHaveLength(0);
  });

  it('should unlock goal badges and return a complete achievement catalog', async () => {
    await request(app)
      .post('/api/wellness-goals')
      .set(getAuthHeader(token))
      .send({ title: 'Complete 1 goal', targetValue: 1, currentValue: 0, unit: 'goal' });

    const goals = await WellnessGoal.find({ userId: user._id });
    await request(app)
      .patch(`/api/wellness-goals/${goals[0]._id}/progress`)
      .set(getAuthHeader(token))
      .send({ currentValue: 1 });

    const res = await request(app)
      .get('/api/user/achievements')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.achievements)).toBe(true);
    expect(res.body.achievements.length).toBeGreaterThanOrEqual(13);

    const goalGetter = res.body.achievements.find((badge) => badge.id === 'goal-getter');
    expect(goalGetter).toBeTruthy();
    expect(goalGetter.unlocked).toBe(true);

    const locked = res.body.achievements.find((badge) => badge.id === 'dedicated-learner');
    expect(locked.unlocked).toBe(false);
    expect(locked.progress.target).toBe(5);
    expect(res.body.stats.total).toBe(res.body.achievements.length);
  });

  it('should return a complete analytics dashboard', async () => {
    const course = await Course.create({
      title: 'Analytics Course',
      description: 'Course for analytics',
      category: 'Mental Wellness',
      duration: '2 hours',
      videos: [{ title: 'Intro', videoUrl: 'http://test.com/1', duration: 120, order: 1 }],
      pdfs: [],
    });

    await Enrollment.create({
      userId: user._id,
      courseId: course._id,
      progress: 50,
      lastAccessedAt: new Date(),
    });

    await EventRegistration.create({
      userId: user._id,
      eventId: new mongoose.Types.ObjectId(),
      status: 'confirmed',
    });

    await Assessment.create({
      user: user._id,
      age: 30,
      occupation: 'Engineer',
      location: 'Delhi',
      stressLevel: 6,
      sleepQuality: 7,
      energyLevel: 8,
      moodRating: 7,
      physicalIssue: true,
      specialDiseaseIssue: false,
      relationshipIssue: false,
      financialIssue: false,
      mentalHealthIssue: true,
      spiritualGrowth: true,
    });

    await Certificate.create({
      certificateId: `CERT-${uid()}`,
      user: user._id,
      course: course._id,
      issuedTo: user.displayName,
      courseName: course.title,
    });

    await WellnessGoal.create({
      userId: user._id,
      title: 'Analytics goal',
      category: 'mental',
      targetValue: 10,
      currentValue: 2,
      unit: 'days',
      status: 'active',
    });

    const res = await request(app)
      .get('/api/user/analytics?range=30')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rangeDays).toBe(30);
    expect(res.body.learning.totalEnrollments).toBe(1);
    expect(res.body.learning.averageProgress).toBe(50);
    expect(res.body.events.registrations).toBe(1);
    expect(res.body.goals.active).toBe(1);
    expect(res.body.wellness.wellnessScore).toBeGreaterThan(0);
    expect(res.body.courses).toHaveLength(1);
    expect(res.body.trend).toHaveLength(30);
    expect(res.body.profile.completeness.percent).toBeGreaterThan(0);
    expect(typeof res.body.overview.currentStreak).toBe('number');
  });

  it('should expose printable certificate pages and verification links', async () => {
    const certificateId = `PS-CERT-${uid()}`;
    await Certificate.create({
      certificateId,
      user: user._id,
      course: new mongoose.Types.ObjectId(),
      issuedTo: user.displayName,
      courseName: 'Certificate Course',
    });

    const list = await request(app)
      .get('/api/user/profile/certificates')
      .set(getAuthHeader(token));

    expect(list.status).toBe(200);
    expect(list.body.certificates[0].viewUrl).toContain(`/api/certificates/${certificateId}/view`);
    expect(list.body.certificates[0].verificationUrl).toContain(`/api/certificates/verify/${certificateId}`);

    const view = await request(app).get(`/api/certificates/${certificateId}/view`);
    expect(view.status).toBe(200);
    expect(view.headers['content-type']).toContain('text/html');
    expect(view.text).toContain(certificateId);
    expect(view.text).toContain('Certificate of Completion');

    const verify = await request(app).get(`/api/certificates/verify/${certificateId}`);
    expect(verify.status).toBe(200);
    expect(verify.body.valid).toBe(true);
  });
});
