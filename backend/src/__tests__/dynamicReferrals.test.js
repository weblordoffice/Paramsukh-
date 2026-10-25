import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { User } from '../models/user.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { Course } from '../models/course.models.js';
import { Referral } from '../models/referral.models.js';
import { ReferralConfig } from '../models/referralConfig.models.js';
import { ReferralEarningRule } from '../models/referralEarningRule.models.js';
import { PointTransaction } from '../models/pointTransaction.models.js';
import {
  getAuthHeader,
  generateUserToken,
  createTestAdmin,
  generateAdminToken,
} from './helpers.js';

setupDB();

const app = createTestApp();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

describe('Dynamic Referral System', () => {
  let referrer;
  let referrerToken;
  let config;

  beforeEach(async () => {
    await User.deleteMany({});
    await Enrollment.deleteMany({});
    await Course.deleteMany({});
    await Referral.deleteMany({});
    await ReferralConfig.deleteMany({});
    await ReferralEarningRule.deleteMany({});
    await PointTransaction.deleteMany({});

    // 1. Create active referral config
    config = await ReferralConfig.create({
      isActive: true,
      pointValueInRupees: 1,
      minRedemptionPoints: 1,
      minReferrerAccountAgeDays: 0,
      referralCodeFormat: 'random8',
    });

    // 2. Create referrer
    referrer = await User.create({
      phone: `+91${uid()}`,
      displayName: 'Referrer User',
      email: `${uid()}@test.com`,
      authProvider: 'phone',
      referralCode: 'PARAM-REFER'
    });

    referrerToken = generateUserToken(referrer._id);

    // Register active device session for test user
    const { DeviceSession } = await import('../models/deviceSession.models.js');
    await DeviceSession.create({
      user: referrer._id,
      deviceId: 'test-device-id',
      deviceName: 'Test Phone',
      os: 'iOS',
      browser: 'App',
      authProvider: 'phone'
    });
  });

  it('should list user referral code and points in dashboard', async () => {
    const res = await request(app)
      .get('/api/user/profile/referrals')
      .set(getAuthHeader(referrerToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.referralCode).toBe('PARAM-REFER');
    expect(res.body.points).toBe(0);
    expect(res.body.pointValue).toBe(1);
    expect(res.body.referrals).toHaveLength(0);
  });

  it('should process referral configuration updates for admin', async () => {
    const admin = await createTestAdmin();
    const token = generateAdminToken(admin._id);

    const res = await request(app)
      .put('/api/admin/referral/config')
      .set(getAuthHeader(token))
      .send({
        pointValueInRupees: 2,
        minRedemptionPoints: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config.pointValueInRupees).toBe(2);
    expect(res.body.config.minRedemptionPoints).toBe(10);
  });

  it('should award points to the referrer when the referred user completes a course', async () => {
    await ReferralEarningRule.create({
      name: 'Course Complete',
      slug: 'course-complete',
      triggerEvent: 'user.course_complete',
      pointsValue: 25,
      isActive: true,
    });

    // 1. Create referred user
    const referee = await User.create({
      phone: `+91${uid()}`,
      displayName: 'Referred Friend',
      email: `${uid()}@test.com`,
      authProvider: 'phone',
      referredBy: referrer._id
    });

    const refereeToken = generateUserToken(referee._id);

    // Register active device session for referee
    const { DeviceSession } = await import('../models/deviceSession.models.js');
    await DeviceSession.create({
      user: referee._id,
      deviceId: 'test-device-id',
      deviceName: 'Test Phone',
      os: 'iOS',
      browser: 'App',
      authProvider: 'phone'
    });

    // Create referral linkage
    await Referral.create({
      referrer: referrer._id,
      referredUser: referee._id,
      referralCode: referrer.referralCode,
      status: 'joined'
    });

    // Create course
    const course = await Course.create({
      title: 'Healthy Living',
      description: 'Learn wellness secrets',
      category: 'Mental Wellness',
      duration: '1 hour',
      status: 'published',
      videos: [{ title: 'Intro', videoUrl: 'http://test.com', duration: 120, order: 1 }],
      pdfs: []
    });

    // Enroll referee
    await Enrollment.create({
      userId: referee._id,
      courseId: course._id,
      progress: 0,
      completedVideos: []
    });

    // Record watch proof, then mark course complete to 100%
    await request(app)
      .patch(`/api/enrollments/course/${course._id}/position`)
      .set(getAuthHeader(refereeToken))
      .send({ videoId: course.videos[0]._id, positionSeconds: 95, durationSeconds: 100, isPaused: true });

    const res = await request(app)
      .post(`/api/courses/${course._id}/progress/video/${course.videos[0]._id}`)
      .set(getAuthHeader(refereeToken));

    expect(res.status).toBe(200);
    expect(res.body.data.isCompleted).toBe(true);

    // Verify referrer received points for the course-completion event
    const txn = await PointTransaction.findOne({
      userId: referrer._id,
      referredUserId: referee._id,
      type: 'user.course_complete',
    });
    expect(txn).not.toBeNull();
    expect(txn.points).toBe(25);

    const dbReferrer = await User.findById(referrer._id);
    expect(dbReferrer.referralPoints).toBe(25);
    expect(dbReferrer.totalPointsEarned).toBe(25);
  });
});
