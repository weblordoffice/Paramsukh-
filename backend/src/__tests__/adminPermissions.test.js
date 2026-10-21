import request from 'supertest';
import createTestApp from './app.js';
import {
  createTestAdmin,
  createTestSuperAdmin,
  generateAdminToken,
  getAuthHeader,
  getAdminApiKeyHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

describe('Admin permission enforcement', () => {
  it('allows an admin with the matching permission', async () => {
    const admin = await createTestAdmin({ permissions: ['manage_users'] });
    const token = generateAdminToken(admin._id);

    const res = await request(app)
      .get('/api/user/all')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects an admin without the matching permission', async () => {
    const admin = await createTestAdmin({
      email: 'courses-only@example.com',
      permissions: ['manage_courses'],
    });
    const token = generateAdminToken(admin._id);

    const res = await request(app)
      .get('/api/user/all')
      .set(getAuthHeader(token));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('allows an admin to reach a route covered by their permission', async () => {
    const admin = await createTestAdmin({
      email: 'courses-admin@example.com',
      permissions: ['manage_courses'],
    });
    const token = generateAdminToken(admin._id);

    const res = await request(app)
      .get('/api/live-sessions/admin/all')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('always allows super_admin', async () => {
    const superAdmin = await createTestSuperAdmin();
    const token = generateAdminToken(superAdmin._id);

    const userRes = await request(app)
      .get('/api/user/all')
      .set(getAuthHeader(token));
    const couponRes = await request(app)
      .get('/api/admin/coupons')
      .set(getAuthHeader(token));

    expect(userRes.status).toBe(200);
    expect(couponRes.status).toBe(200);
  });

  it('treats the server API key as fully trusted', async () => {
    const userRes = await request(app)
      .get('/api/user/all')
      .set(getAdminApiKeyHeader());
    const couponRes = await request(app)
      .get('/api/admin/coupons')
      .set(getAdminApiKeyHeader());

    expect(userRes.status).toBe(200);
    expect(couponRes.status).toBe(200);
  });

  it('rejects an inactive admin even with matching permissions', async () => {
    const admin = await createTestAdmin({
      email: 'inactive-admin@example.com',
      permissions: ['manage_users'],
      isActive: false,
    });
    const token = generateAdminToken(admin._id);

    const res = await request(app)
      .get('/api/user/all')
      .set(getAuthHeader(token));

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
