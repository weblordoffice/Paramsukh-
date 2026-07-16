import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { User } from '../models/user.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { Course } from '../models/course.models.js';
import { Referral } from '../models/referral.models.js';
import { ReferralConfig } from '../models/referralConfig.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { getAuthHeader, generateUserToken } from './helpers.js';

setupDB();

const app = createTestApp();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

describe('Dynamic Referral System', () => {
  let referrer;
  let referrerToken;
  let campaign;

  beforeEach(async () => {
    await User.deleteMany({});
    await Enrollment.deleteMany({});
    await Course.deleteMany({});
    await Referral.deleteMany({});
    await ReferralConfig.deleteMany({});
    await UserMembership.deleteMany({});
    await MembershipPlan.deleteMany({});

    // Create default premium plan
    await MembershipPlan.create({
      title: 'Premium Plan',
      slug: 'pro',
      description: 'Test premium plan',
      pricing: {
        oneTime: { amount: 999, currency: 'INR' }
      },
      validityDays: 30,
      isActive: true
    });

    // 1. Create active referral config
    campaign = await ReferralConfig.create({
      campaignName: 'Test Launch Reward Campaign',
      isActive: true,
      rewardType: 'premium_extension',
      rewardValue: 10,
      referrerRewardText: 'Extend your Premium by 10 days!',
      refereeRewardText: 'Get 10% off!'
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

  it('should list user referral code and reward descriptions in dashboard', async () => {
    const res = await request(app)
      .get('/api/user/profile/referrals')
      .set(getAuthHeader(referrerToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.referralCode).toBe('PARAM-REFER');
    expect(res.body.referrerRewardText).toBe('Extend your Premium by 10 days!');
    expect(res.body.refereeRewardText).toBe('Get 10% off!');
    expect(res.body.referrals).toHaveLength(0);
  });

  it('should process referral configuration updates for admin', async () => {
    const adminKeyHeader = { 'X-Admin-API-Key': process.env.ADMIN_API_KEY || 'test-admin-key' };
    const res = await request(app)
      .put('/api/user/referral-config')
      .set(adminKeyHeader)
      .send({
        rewardType: 'unlock_course',
        rewardValue: '5f7b3a2b9d3e2a1b2c3d4e5f',
        referrerRewardText: 'Unlock Meditation Course!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config.rewardType).toBe('unlock_course');
    expect(res.body.config.rewardValue).toBe('5f7b3a2b9d3e2a1b2c3d4e5f');
    expect(res.body.config.referrerRewardText).toBe('Unlock Meditation Course!');
  });

  it('should award premium extension days to referrer when referred user completes course', async () => {
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
      status: 'joined'
    });

    // Create course
    const course = await Course.create({
      title: 'Healthy Living',
      description: 'Learn wellness secrets',
      category: 'Mental Wellness',
      duration: '1 hour',
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

    // Mark course complete to 100%
    const res = await request(app)
      .post(`/api/courses/${course._id}/progress/video/${course.videos[0]._id}`)
      .set(getAuthHeader(refereeToken));

    expect(res.status).toBe(200);
    expect(res.body.data.isCompleted).toBe(true);

    // Verify referrer received membership reward (10 days as configured in test campaign)
    const membership = await UserMembership.findOne({ userId: referrer._id });
    expect(membership).not.toBeNull();
    expect(membership.status).toBe('active');
    
    // Check validity difference
    const diffDays = Math.round((membership.endDate.getTime() - membership.startDate.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(10);

    // Verify referrer unlocked "wellness-guide" badge
    const dbReferrer = await User.findById(referrer._id);
    expect(dbReferrer.unlockedBadges.some(b => b.badgeId === 'wellness-guide')).toBe(true);

    // Verify referral record is updated to completed
    const dbReferral = await Referral.findOne({ referredUser: referee._id });
    expect(dbReferral.status).toBe('completed');
    expect(dbReferral.rewardApplied).toBe(true);
  });
});
