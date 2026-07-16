import request from 'supertest';
import createTestApp from './app.js';
import {
  createTestUser,
  TEST_PHONE,
  generateUserToken,
  getAuthHeader,
  createTestDeviceSession,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

describe('User Module - /api/user', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await createTestUser();
    token = generateUserToken(user._id);
  });

  describe('GET /api/user/profile', () => {
    it('should return user profile', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user._id).toBe(user._id.toString());
      expect(res.body.user.displayName).toBe('Test User');
      expect(res.body.user.phone).toBe(`+91${TEST_PHONE}`);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/user/profile');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for deleted user', async () => {
      token = generateUserToken('5f7b3a2b9d3e2a1b2c3d4e5f');

      const res = await request(app)
        .get('/api/user/profile')
        .set(getAuthHeader(token));

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/user/profile', () => {
    it('should update display name', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set(getAuthHeader(token))
        .send({ displayName: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.displayName).toBe('Updated Name');
    });

    it('should update photo URL', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set(getAuthHeader(token))
        .send({ photoURL: 'https://example.com/photo.jpg' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.photoURL).toBe('https://example.com/photo.jpg');
    });

    it('should reject empty display name', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set(getAuthHeader(token))
        .send({ displayName: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject short display name (< 2 chars)', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set(getAuthHeader(token))
        .send({ displayName: 'A' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject update with no valid fields', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set(getAuthHeader(token))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No valid fields');
    });

    it('should reject without auth', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .send({ displayName: 'No Auth' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/user/profile/photo', () => {
    it('should update profile photo', async () => {
      const res = await request(app)
        .put('/api/user/profile/photo')
        .set(getAuthHeader(token))
        .send({ photoURL: 'https://example.com/avatar.jpg' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.photoURL).toBe('https://example.com/avatar.jpg');
    });

    it('should reject missing photo URL', async () => {
      const res = await request(app)
        .put('/api/user/profile/photo')
        .set(getAuthHeader(token))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/user/profile/photo', () => {
    it('should remove profile photo', async () => {
      const res = await request(app)
        .delete('/api/user/profile/photo')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('removed');
    });
  });

  describe('PUT /api/user/preferences', () => {
    it('should update theme preference', async () => {
      const res = await request(app)
        .put('/api/user/preferences')
        .set(getAuthHeader(token))
        .send({ theme: 'dark' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.preferences.theme).toBe('dark');
    });

    it('should reject invalid theme', async () => {
      const res = await request(app)
        .put('/api/user/preferences')
        .set(getAuthHeader(token))
        .send({ theme: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should update multiple preferences', async () => {
      const res = await request(app)
        .put('/api/user/preferences')
        .set(getAuthHeader(token))
        .send({
          theme: 'light',
          notifications: false,
          autoPlay: false,
          dataSaver: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const prefs = res.body.preferences;
      expect(prefs.theme).toBe('light');
      expect(prefs.notifications).toBe(false);
      expect(prefs.autoPlay).toBe(false);
      expect(prefs.dataSaver).toBe(true);
    });
  });

  describe('GET /api/user/subscription', () => {
    it('should return subscription details for free user', async () => {
      const res = await request(app)
        .get('/api/user/subscription')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.subscription).toBeDefined();
      expect(res.body.subscription.plan).toBe('free');
      expect(res.body.subscription.hasProAccess).toBe(false);
    });

    it('should return subscription for pro user', async () => {
      const proUser = await createTestUser({
        phone: `+919876543211`,
        subscriptionPlan: 'pro',
        subscriptionStatus: 'active',
      });
      const proToken = generateUserToken(proUser._id);

      const res = await request(app)
        .get('/api/user/subscription')
        .set(getAuthHeader(proToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/user/stats', () => {
    it('should return user statistics', async () => {
      const res = await request(app)
        .get('/api/user/stats')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.totalEnrollments).toBe(0);
      expect(res.body.stats.completedCourses).toBe(0);
      expect(res.body.stats.loginCount).toBe(1);
    });
  });

  describe('POST /api/user/deactivate', () => {
    it('should deactivate user account', async () => {
      const res = await request(app)
        .post('/api/user/deactivate')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Account deactivated');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/user/deactivate');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/user/account', () => {
    it('should delete account with correct confirmation', async () => {
      const res = await request(app)
        .delete('/api/user/account')
        .set(getAuthHeader(token))
        .send({ confirmDelete: 'DELETE' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted permanently');
    });

    it('should reject deletion without confirmation', async () => {
      const res = await request(app)
        .delete('/api/user/account')
        .set(getAuthHeader(token))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('confirmDelete');
    });

    it('should reject deletion with wrong confirmation', async () => {
      const res = await request(app)
        .delete('/api/user/account')
        .set(getAuthHeader(token))
        .send({ confirmDelete: 'NO' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
