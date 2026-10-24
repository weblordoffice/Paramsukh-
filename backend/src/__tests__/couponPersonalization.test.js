import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { User } from '../models/user.models.js';
import Coupon from '../models/coupon.models.js';
import CouponUsage from '../models/couponUsage.models.js';
import Notification, { DeviceToken } from '../models/notification.models.js';
import { processPendingCouponNotifications } from '../services/couponCron.service.js';
import {
  createTestUser,
  createTestUser2,
  createTestDeviceSession,
  generateUserToken,
  getAuthHeader,
  getAdminApiKeyHeader,
} from './helpers.js';

setupDB();

const app = createTestApp();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

const baseCouponPayload = (overrides = {}) => ({
  code: `PERSONAL${uid()}`,
  description: 'Personal coupon',
  discountType: 'flat',
  discountValue: 100,
  purchaseTypes: ['shop'],
  applicableOn: 'all',
  startDate: new Date(Date.now() - 3600000).toISOString(),
  endDate: new Date(Date.now() + 86400000).toISOString(),
  ...overrides,
});

describe('Personalized coupons', () => {
  let userA;
  let userB;
  let tokenA;
  let tokenB;

  beforeEach(async () => {
    await User.deleteMany({});
    await Coupon.deleteMany({});
    await CouponUsage.deleteMany({});
    await Notification.deleteMany({});
    await DeviceToken.deleteMany({});

    userA = await createTestUser({ email: `coupon-a-${uid()}@test.com` });
    userB = await createTestUser2({ email: `coupon-b-${uid()}@test.com` });
    await createTestDeviceSession(userB._id);
    tokenA = generateUserToken(userA._id);
    tokenB = generateUserToken(userB._id);
  });

  it('rejects coupon creation without assigned users', async () => {
    const res = await request(app)
      .post('/api/admin/coupons')
      .set(getAdminApiKeyHeader())
      .send(baseCouponPayload());

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Select at least one user');
  });

  it('notifies assigned users once and newly added users on update', async () => {
    const created = await request(app)
      .post('/api/admin/coupons')
      .set(getAdminApiKeyHeader())
      .send(baseCouponPayload({ applicableUsers: [userA._id.toString()] }));

    expect(created.status).toBe(201);
    expect(created.body.coupon.userRestriction).toBe('specific');
    expect(created.body.notified).toBe(1);

    expect(await Notification.countDocuments({ user: userA._id, type: 'coupon' })).toBe(1);
    expect(await Notification.countDocuments({ user: userB._id, type: 'coupon' })).toBe(0);

    const unchanged = await request(app)
      .put(`/api/admin/coupons/${created.body.coupon._id}`)
      .set(getAdminApiKeyHeader())
      .send({ applicableUsers: [userA._id.toString()] });

    expect(unchanged.status).toBe(200);
    expect(unchanged.body.notified).toBe(0);
    expect(await Notification.countDocuments({ user: userA._id, type: 'coupon' })).toBe(1);

    const added = await request(app)
      .put(`/api/admin/coupons/${created.body.coupon._id}`)
      .set(getAdminApiKeyHeader())
      .send({ applicableUsers: [userA._id.toString(), userB._id.toString()] });

    expect(added.status).toBe(200);
    expect(added.body.notified).toBe(1);
    expect(await Notification.countDocuments({ user: userB._id, type: 'coupon' })).toBe(1);
  });

  it('only lists coupons assigned to the requesting user', async () => {
    await request(app)
      .post('/api/admin/coupons')
      .set(getAdminApiKeyHeader())
      .send(baseCouponPayload({
        code: 'ONLYA',
        applicableUsers: [userA._id.toString()],
      }));

    await request(app)
      .post('/api/admin/coupons')
      .set(getAdminApiKeyHeader())
      .send(baseCouponPayload({
        code: 'ONLYB',
        applicableUsers: [userB._id.toString()],
      }));

    const mineA = await request(app)
      .get('/api/coupons/mine')
      .set(getAuthHeader(tokenA));

    expect(mineA.status).toBe(200);
    expect(mineA.body.coupons.map((coupon) => coupon.code)).toEqual(['ONLYA']);
    expect(mineA.body.coupons[0].status).toBe('active');

    const mineB = await request(app)
      .get('/api/coupons/mine')
      .set(getAuthHeader(tokenB));

    expect(mineB.status).toBe(200);
    expect(mineB.body.coupons.map((coupon) => coupon.code)).toEqual(['ONLYB']);
  });

  it('notifies scheduled coupons only after they become active', async () => {
    const coupon = await Coupon.create({
      ...baseCouponPayload({ code: 'SCHEDULED' }),
      userRestriction: 'specific',
      applicableUsers: [userA._id],
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 2 * 86400000),
    });

    const beforeStart = await processPendingCouponNotifications();
    expect(beforeStart.notified).toBe(0);
    expect(await Notification.countDocuments({ user: userA._id, type: 'coupon' })).toBe(0);

    await Coupon.updateOne(
      { _id: coupon._id },
      { $set: { startDate: new Date(Date.now() - 1000) } }
    );

    const afterStart = await processPendingCouponNotifications();
    expect(afterStart.notified).toBe(1);
    expect(await Notification.countDocuments({ user: userA._id, type: 'coupon' })).toBe(1);
  });

  it('blocks users who are not assigned to the coupon', async () => {
    const coupon = await Coupon.create({
      ...baseCouponPayload({ code: 'LOCKED' }),
      userRestriction: 'specific',
      applicableUsers: [userA._id],
    });

    const allowed = await coupon.canUserUse(userA._id, 500);
    expect(allowed.valid).toBe(true);

    const denied = await coupon.canUserUse(userB._id, 500);
    expect(denied.valid).toBe(false);
    expect(denied.message).toContain('not applicable');
  });
});
