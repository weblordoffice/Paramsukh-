import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { User } from '../models/user.models.js';
import { DeviceSession } from '../models/deviceSession.models.js';
import {
  generateUserToken,
  generateRefreshToken,
  getAuthHeader,
} from './helpers.js';

setupDB();

const app = createTestApp();

const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
const validPhone = () => {
  const base = `${Date.now()}`.slice(-9);
  return `${Math.floor(Math.random() * 4) + 6}${base}`;
};

const TEST_OTP = '123456';

const sendAndGetPhone = async () => {
  const phone = validPhone();
  await request(app).post('/api/auth/send-otp').send({ phone });
  return phone;
};

describe('Auth Module - /api/auth', () => {
  describe('POST /api/auth/send-otp', () => {
    it('should send OTP for valid new phone', async () => {
      const phone = validPhone();
      const res = await request(app).post('/api/auth/send-otp').send({ phone });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isNewUser).toBe(true);
    });

    it('should send OTP for existing user', async () => {
      const phone = validPhone();
      await User.create({ phone: `+91${phone}`, displayName: 'Test', email: `${uid()}@test.com`, authProvider: 'phone' });
      const res = await request(app).post('/api/auth/send-otp').send({ phone });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isNewUser).toBe(false);
    });

    it('should reject signin for non-existent user', async () => {
      const phone = validPhone();
      const res = await request(app).post('/api/auth/send-otp').send({ phone, purpose: 'signin' });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should reject signup for existing user', async () => {
      const phone = validPhone();
      await User.create({ phone: `+91${phone}`, displayName: 'Test', email: `${uid()}@test.com`, authProvider: 'phone' });
      const res = await request(app).post('/api/auth/send-otp').send({ phone, purpose: 'signup' });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid phone format', async () => {
      const res = await request(app).post('/api/auth/send-otp').send({ phone: '12345' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should accept phone with +91 prefix', async () => {
      const phone = validPhone();
      const res = await request(app).post('/api/auth/send-otp').send({ phone: `+91${phone}` });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject phone starting with 1', async () => {
      const res = await request(app).post('/api/auth/send-otp').send({ phone: '1234567890' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('should register new user with valid OTP', async () => {
      const phone = await sendAndGetPhone();
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, otp: TEST_OTP, name: 'Test User', email: `${uid()}@test.com` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isNewUser).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.phone).toBe(`+91${phone}`);
    });

    it('should sign in existing user via OTP', async () => {
      const phone = await sendAndGetPhone();
      await User.create({ phone: `+91${phone}`, displayName: 'Test', email: `${uid()}@test.com`, authProvider: 'phone' });

      await request(app).post('/api/auth/send-otp').send({ phone });
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, otp: TEST_OTP });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isNewUser).toBe(false);
      expect(res.body.token).toBeDefined();
    });

    it('should reject with wrong OTP', async () => {
      const phone = validPhone();
      await request(app).post('/api/auth/send-otp').send({ phone });

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, otp: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid OTP');
    });

    it('should reject when OTP was never sent', async () => {
      const phone = validPhone();
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, otp: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('expired');
    });

    it('should reject missing phone', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ otp: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing OTP', async () => {
      const phone = await sendAndGetPhone();
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject new user without name', async () => {
      const phone = await sendAndGetPhone();
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, otp: TEST_OTP, email: `${uid()}@test.com` });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Name is required');
    });

    it('should reject new user with invalid email', async () => {
      const phone = await sendAndGetPhone();
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, otp: TEST_OTP, name: 'Test User', email: 'bad-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Valid email');
    });

    it('should reject duplicate email', async () => {
      const phone = await sendAndGetPhone();
      const email = `${uid()}@test.com`;
      await User.create({ phone: `+91${validPhone()}`, displayName: 'User1', email, authProvider: 'phone' });

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, otp: TEST_OTP, name: 'User2', email });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Email already registered');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let user;
    beforeEach(async () => {
      user = await User.create({
        phone: `+91${validPhone()}`,
        displayName: 'Refresh Test',
        email: `${uid()}@test.com`,
        authProvider: 'phone',
      });
    });

    it('should refresh with valid token', async () => {
      const rToken = generateRefreshToken(user._id);
      const res = await request(app).post('/api/auth/refresh-token').send({ refreshToken: rToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    it('should reject missing refresh token', async () => {
      const res = await request(app).post('/api/auth/refresh-token').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app).post('/api/auth/refresh-token').send({ refreshToken: 'bad-token' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject for non-existent user', async () => {
      const fakeToken = generateRefreshToken('5f7b3a2b9d3e2a1b2c3d4e5f');
      const res = await request(app).post('/api/auth/refresh-token').send({ refreshToken: fakeToken });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject for inactive user', async () => {
      const inactive = await User.create({
        phone: `+91${validPhone()}`,
        displayName: 'Inactive', email: `${uid()}@test.com`,
        authProvider: 'phone', isActive: false,
      });
      const rToken = generateRefreshToken(inactive._id);
      const res = await request(app).post('/api/auth/refresh-token').send({ refreshToken: rToken });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    let user, token;
    beforeEach(async () => {
      user = await User.create({
        phone: `+91${validPhone()}`,
        displayName: 'Logout Test', email: `${uid()}@test.com`,
        authProvider: 'phone',
      });
      await DeviceSession.create({
        user: user._id,
        deviceId: 'test-device-id',
        deviceName: 'Test Device',
        os: 'iOS',
        browser: 'App',
        authProvider: 'phone'
      });
      token = generateUserToken(user._id);
    });

    it('should logout successfully', async () => {
      const res = await request(app).post('/api/auth/logout').set(getAuthHeader(token));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject logout without token', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    let user, token;
    beforeEach(async () => {
      user = await User.create({
        phone: `+91${validPhone()}`,
        displayName: 'Me Test', email: `${uid()}@test.com`,
        authProvider: 'phone',
      });
      await DeviceSession.create({
        user: user._id,
        deviceId: 'test-device-id',
        deviceName: 'Test Device',
        os: 'iOS',
        browser: 'App',
        authProvider: 'phone'
      });
      token = generateUserToken(user._id);
    });

    it('should return current user', async () => {
      const res = await request(app).get('/api/auth/me').set(getAuthHeader(token));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user._id).toBe(user._id.toString());
    });

    it('should reject unauthenticated', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid token', async () => {
      const res = await request(app).get('/api/auth/me').set(getAuthHeader('bad-token'));
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/auth/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
