import request from 'supertest';
import createTestApp from './app.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import {
  createTestUser,
  generateUserToken,
  getAuthHeader,
  getAdminApiKeyHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

const createPlan = (overrides = {}) => MembershipPlan.create({
  title: 'Plan',
  slug: 'plan',
  status: 'published',
  pricing: { oneTime: { amount: 100, currency: 'INR' } },
  validityDays: 365,
  ...overrides,
});

describe('Membership plan hierarchy - /api/membership-plans', () => {
  let user;
  let token;
  let bronze;
  let copper;
  let silver;

  beforeEach(async () => {
    user = await createTestUser({ subscriptionPlan: 'silver', subscriptionStatus: 'active' });
    token = generateUserToken(user._id);

    bronze = await createPlan({ title: 'Bronze', slug: 'bronze', planKind: 'tiered', tierLevel: 1 });
    copper = await createPlan({
      title: 'Copper',
      slug: 'copper',
      planKind: 'tiered',
      tierLevel: 2,
      access: { inheritedPlanIds: [bronze._id] },
    });
    silver = await createPlan({
      title: 'Silver',
      slug: 'silver',
      planKind: 'tiered',
      tierLevel: 3,
      access: { inheritedPlanIds: [copper._id, bronze._id] },
    });

    await UserMembership.create({
      userId: user._id,
      planId: silver._id,
      planSnapshot: {
        title: 'Silver',
        slug: 'silver',
        pricing: { amount: 100, currency: 'INR', type: 'one_time' },
      },
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    });
  });

  describe('GET /api/membership-plans/eligible', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/membership-plans/eligible');
      expect(res.status).toBe(401);
    });

    it('should annotate coverage for a silver owner', async () => {
      const res = await request(app)
        .get('/api/membership-plans/eligible')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      const bySlug = Object.fromEntries(res.body.data.map((plan) => [plan.slug, plan]));

      expect(bySlug.silver.isOwned).toBe(true);
      expect(bySlug.silver.isCovered).toBe(false);
      expect(bySlug.copper.isCovered).toBe(true);
      expect(bySlug.bronze.isCovered).toBe(true);
      expect(bySlug.bronze.coveredBy).toContain('silver');
    });

    it('should flag a higher plan as an upgrade', async () => {
      const gold = await createPlan({
        title: 'Gold',
        slug: 'gold',
        planKind: 'tiered',
        tierLevel: 4,
        access: { inheritedPlanIds: [silver._id] },
      });

      const res = await request(app)
        .get('/api/membership-plans/eligible')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      const bySlug = Object.fromEntries(res.body.data.map((plan) => [plan.slug, plan]));
      expect(bySlug[gold.slug].isUpgrade).toBe(true);
      expect(bySlug[gold.slug].isCovered).toBe(false);
    });
  });

  describe('POST /api/payments/create-order (purchase guard)', () => {
    it('should reject buying a plan already included in the user plan', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .set(getAuthHeader(token))
        .send({ plan: 'bronze' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PLAN_ALREADY_INCLUDED');
    });
  });

  describe('Plan relationship validation', () => {
    it('should reject circular inheritance', async () => {
      // bronze currently includes nothing; make it include silver, which
      // (transitively) already includes bronze -> cycle.
      const res = await request(app)
        .patch(`/api/membership-plans/${bronze._id}`)
        .set(getAdminApiKeyHeader())
        .send({ planKind: 'tiered', access: { inheritedPlanIds: [silver._id] } });

      expect(res.status).toBe(400);
    });

    it('should reject a standalone plan that includes other plans', async () => {
      const res = await request(app)
        .patch(`/api/membership-plans/${copper._id}`)
        .set(getAdminApiKeyHeader())
        .send({ planKind: 'standalone' });

      expect(res.status).toBe(400);
    });
  });
});
