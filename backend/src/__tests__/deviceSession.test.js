import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { User } from '../models/user.models.js';
import { DeviceSession, DeviceRegistrationLog } from '../models/deviceSession.models.js';
import {
  generateUserToken,
  generateRefreshToken,
  getAuthHeader
} from './helpers.js';

setupDB();

const app = createTestApp();

const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

const validPhone = () => {
  const base = `${Date.now()}`.slice(-9);
  return `${Math.floor(Math.random() * 4) + 6}${base}`;
};

const TEST_OTP = '123456';

const sendOTP = async (phone) => {
  await request(app).post('/api/auth/send-otp').send({ phone });
};

describe('Device Session Management', () => {
  let user;
  let phone;

  beforeEach(async () => {
    await User.deleteMany({});
    await DeviceSession.deleteMany({});
    await DeviceRegistrationLog.deleteMany({});

    phone = validPhone();
    user = await User.create({
      phone: `+91${phone}`,
      displayName: 'Device Test User',
      email: `${uid()}@test.com`,
      authProvider: 'phone'
    });

    await sendOTP(phone);
  });

  it('should register Device 1 and Device 2 successfully, but reject Device 3 with limit check', async () => {
    // 1. Verify OTP with Device 1
    await sendOTP(phone);
    const res1 = await request(app)
      .post('/api/auth/verify-otp')
      .set('x-device-id', 'device-1')
      .set('x-device-name', 'Test iPhone')
      .set('x-device-os', 'iOS')
      .set('x-device-browser', 'Safari')
      .send({ phone, otp: TEST_OTP });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.token).toBeDefined();

    // Verify session registered in DB
    const session1 = await DeviceSession.findOne({ user: user._id, deviceId: 'device-1', isRevoked: false });
    expect(session1).not.toBeNull();
    expect(session1.deviceName).toBe('Test iPhone');

    // 2. Verify OTP with Device 2
    await sendOTP(phone);
    const res2 = await request(app)
      .post('/api/auth/verify-otp')
      .set('x-device-id', 'device-2')
      .set('x-device-name', 'Test iPad')
      .set('x-device-os', 'iOS')
      .set('x-device-browser', 'Safari')
      .send({ phone, otp: TEST_OTP });

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);

    const session2 = await DeviceSession.findOne({ user: user._id, deviceId: 'device-2', isRevoked: false });
    expect(session2).not.toBeNull();

    // 3. Attempt to log in Device 3
    await sendOTP(phone);
    const res3 = await request(app)
      .post('/api/auth/verify-otp')
      .set('x-device-id', 'device-3')
      .set('x-device-name', 'Test iMac')
      .set('x-device-os', 'macOS')
      .set('x-device-browser', 'Chrome')
      .send({ phone, otp: TEST_OTP });

    // Should return 403 Forbidden with deviceLimitExceeded
    expect(res3.status).toBe(403);
    expect(res3.body.success).toBe(false);
    expect(res3.body.deviceLimitExceeded).toBe(true);
    expect(res3.body.activeDevices).toHaveLength(2);
    expect(res3.body.activeDevices[0].deviceId).toBe('device-1');
    expect(res3.body.activeDevices[1].deviceId).toBe('device-2');
  });

  it('should allow logging in on Device 3 after providing x-revoke-device-id', async () => {
    // Register Device 1 and 2
    await DeviceSession.create({
      user: user._id,
      deviceId: 'device-1',
      deviceName: 'Device 1',
      os: 'iOS',
      browser: 'App',
      authProvider: 'phone'
    });
    await DeviceSession.create({
      user: user._id,
      deviceId: 'device-2',
      deviceName: 'Device 2',
      os: 'iOS',
      browser: 'App',
      authProvider: 'phone'
    });

    // Login Device 3 revoking Device 1
    await sendOTP(phone);
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .set('x-device-id', 'device-3')
      .set('x-device-name', 'Device 3')
      .set('x-device-os', 'iOS')
      .set('x-device-browser', 'App')
      .set('x-revoke-device-id', 'device-1')
      .send({ phone, otp: TEST_OTP });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify Device 1 session is revoked
    const session1 = await DeviceSession.findOne({ user: user._id, deviceId: 'device-1' });
    expect(session1.isRevoked).toBe(true);

    // Verify Device 3 session is active
    const session3 = await DeviceSession.findOne({ user: user._id, deviceId: 'device-3', isRevoked: false });
    expect(session3).not.toBeNull();
  });

  it('should enforce rolling 24-hour limit of 3 new device registrations and trigger cooldown', async () => {
    // 1st new device
    await sendOTP(phone);
    const res1 = await request(app)
      .post('/api/auth/verify-otp')
      .set('x-device-id', 'device-1')
      .set('x-device-name', 'Device 1')
      .set('x-device-os', 'iOS')
      .set('x-device-browser', 'App')
      .send({ phone, otp: TEST_OTP });
    expect(res1.status).toBe(200);

    // 2nd new device
    await sendOTP(phone);
    const res2 = await request(app)
      .post('/api/auth/verify-otp')
      .set('x-device-id', 'device-2')
      .set('x-device-name', 'Device 2')
      .set('x-device-os', 'iOS')
      .set('x-device-browser', 'App')
      .set('x-revoke-device-id', 'device-1') // swap slot
      .send({ phone, otp: TEST_OTP });
    expect(res2.status).toBe(200);

    // 3rd new device
    await sendOTP(phone);
    const res3 = await request(app)
      .post('/api/auth/verify-otp')
      .set('x-device-id', 'device-3')
      .set('x-device-name', 'Device 3')
      .set('x-device-os', 'iOS')
      .set('x-device-browser', 'App')
      .set('x-revoke-device-id', 'device-2') // swap slot
      .send({ phone, otp: TEST_OTP });
    expect(res3.status).toBe(200);

    // 4th new device - should trigger cooldown lock
    await sendOTP(phone);
    const res4 = await request(app)
      .post('/api/auth/verify-otp')
      .set('x-device-id', 'device-4')
      .set('x-device-name', 'Device 4')
      .set('x-device-os', 'iOS')
      .set('x-device-browser', 'App')
      .set('x-revoke-device-id', 'device-3')
      .send({ phone, otp: TEST_OTP });

    expect(res4.status).toBe(403);
    expect(res4.body.success).toBe(false);
    expect(res4.body.cooldown).toBe(true);
    expect(res4.body.cooldownRemaining).toBeGreaterThan(0);
  });

  it('should validate middleware session revocation', async () => {
    // Generate active session and token
    await sendOTP(phone);
    const tokenRes = await request(app)
      .post('/api/auth/verify-otp')
      .set('x-device-id', 'device-1')
      .set('x-device-name', 'Device 1')
      .set('x-device-os', 'iOS')
      .set('x-device-browser', 'App')
      .send({ phone, otp: TEST_OTP });

    const token = tokenRes.body.token;

    // Test a protected route, e.g. /me
    const meRes1 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .set('x-device-id', 'device-1');

    expect(meRes1.status).toBe(200);

    // Revoke the session
    await DeviceSession.updateOne({ user: user._id, deviceId: 'device-1' }, { isRevoked: true });

    // Request protected route again - should fail with 401 SESSION_REVOKED
    const meRes2 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .set('x-device-id', 'device-1');

    expect(meRes2.status).toBe(401);
    expect(meRes2.body.code).toBe('SESSION_REVOKED');
  });

  it('should update lastSeen on heartbeat endpoint', async () => {
    // Create active session
    await DeviceSession.create({
      user: user._id,
      deviceId: 'device-1',
      deviceName: 'Device 1',
      os: 'iOS',
      browser: 'App',
      authProvider: 'phone',
      lastSeen: new Date(Date.now() - 5000)
    });

    const token = generateUserToken(user._id);

    const res = await request(app)
      .post('/api/auth/devices/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .set('x-device-id', 'device-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const session = await DeviceSession.findOne({ user: user._id, deviceId: 'device-1' });
    const lastSeenDiff = Date.now() - session.lastSeen.getTime();
    expect(lastSeenDiff).toBeLessThan(1000); // Updated to now
  });
});
