import request from 'supertest';
import createTestApp from './app.js';
import Admin from '../models/admin.models.js';
import {
  createTestAdmin,
  createTestSuperAdmin,
  generateAdminToken,
  getAuthHeader,
  getAdminApiKeyHeader,
  getAdminAuthHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

describe('Admin Module - /api/admin', () => {
  describe('POST /api/admin/login', () => {
    it('should login with valid credentials', async () => {
      const admin = await createTestAdmin({ password: 'password123' });

      const res = await request(app)
        .post('/api/admin/login')
        .send({ email: admin.email, password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.admin.email).toBe(admin.email);
      expect(res.body.admin.role).toBe('admin');
    });

    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({ email: 'admin@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should reject disabled admin account', async () => {
      const admin = await createTestAdmin({ isActive: false, password: 'password123' });

      const res = await request(app)
        .post('/api/admin/login')
        .send({ email: admin.email, password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty credentials', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/logout', () => {
    it('should logout successfully', async () => {
      const res = await request(app).post('/api/admin/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Logged out');
    });
  });

  describe('POST /api/admin/refresh-token', () => {
    it('should refresh admin token with valid refresh token', async () => {
      const admin = await createTestAdmin();
      const token = generateAdminToken(admin._id);
      const res = await request(app)
        .post('/api/admin/refresh-token')
        .send({ refreshToken: token });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('should reject missing refresh token', async () => {
      const res = await request(app)
        .post('/api/admin/refresh-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/admin/refresh-token')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/me', () => {
    it('should return current admin profile', async () => {
      const admin = await createTestAdmin();
      const token = generateAdminToken(admin._id);

      const res = await request(app)
        .get('/api/admin/me')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.admin).toBeDefined();
      expect(res.body.admin.email).toBe(admin.email);
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/api/admin/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/analytics/basic', () => {
    it('should return analytics for authenticated admin', async () => {
      const admin = await createTestAdmin();
      const token = generateAdminToken(admin._id);

      const res = await request(app)
        .get('/api/admin/analytics/basic')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('API Key Auth', () => {
    beforeEach(async () => {
      await createTestAdmin();
    });

    it('should allow access with valid API key (admin user routes)', async () => {
      const res = await request(app)
        .get('/api/user/all')
        .set(getAdminApiKeyHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject with missing API key', async () => {
      const res = await request(app)
        .get('/api/user/all');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject with invalid API key', async () => {
      const res = await request(app)
        .get('/api/user/all')
        .set({ 'X-Admin-API-Key': 'wrong-key' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Super Admin Routes', () => {
    it('should allow super admin to get all admins', async () => {
      const superAdmin = await createTestSuperAdmin();
      const token = generateAdminToken(superAdmin._id);

      const res = await request(app)
        .get('/api/admin/users')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.admins).toBeInstanceOf(Array);
    });

    it('should allow super admin to create new admin', async () => {
      const superAdmin = await createTestSuperAdmin();
      const token = generateAdminToken(superAdmin._id);

      const res = await request(app)
        .post('/api/admin/users')
        .set(getAuthHeader(token))
        .send({
          name: 'New Admin',
          email: 'newadmin@example.com',
          role: 'admin',
          permissions: ['manage_courses'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.admin.email).toBe('newadmin@example.com');
    });

    it('should reject duplicate admin email', async () => {
      await createTestAdmin({ email: 'existing@example.com' });
      const superAdmin = await createTestSuperAdmin();
      const token = generateAdminToken(superAdmin._id);

      const res = await request(app)
        .post('/api/admin/users')
        .set(getAuthHeader(token))
        .send({
          name: 'Duplicate',
          email: 'existing@example.com',
          role: 'admin',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-super admin from accessing admin users', async () => {
      const admin = await createTestAdmin();
      const token = generateAdminToken(admin._id);

      const res = await request(app)
        .get('/api/admin/users')
        .set(getAuthHeader(token));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow super admin to update admin', async () => {
      const superAdmin = await createTestSuperAdmin();
      const target = await createTestAdmin({ email: 'target@example.com' });
      const token = generateAdminToken(superAdmin._id);

      const res = await request(app)
        .put(`/api/admin/users/${target._id}`)
        .set(getAuthHeader(token))
        .send({ name: 'Updated Admin', permissions: ['manage_users'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.admin.name).toBe('Updated Admin');
    });

    it('should allow super admin to delete admin', async () => {
      const superAdmin = await createTestSuperAdmin();
      const target = await createTestAdmin({
        email: 'todelete@example.com',
        password: 'password123',
      });
      const token = generateAdminToken(superAdmin._id);

      const res = await request(app)
        .delete(`/api/admin/users/${target._id}`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should prevent admin from deleting themselves', async () => {
      const superAdmin = await createTestSuperAdmin({
        email: 'self@example.com',
        password: 'password123',
      });
      const token = generateAdminToken(superAdmin._id);

      const res = await request(app)
        .delete(`/api/admin/users/${superAdmin._id}`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Cannot delete yourself');
    });
  });
});
