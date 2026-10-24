import request from 'supertest';
import createTestApp from './app.js';
import Podcast from '../models/podcast.model.js';
import PodcastPurchase from '../models/podcastPurchase.model.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import {
  createTestUser,
  generateUserToken,
  getAuthHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

const createPlan = (slug, tierLevel, inheritedPlanIds = []) => MembershipPlan.create({
  title: slug,
  slug,
  status: 'published',
  planKind: 'tiered',
  tierLevel,
  pricing: { oneTime: { amount: 1000, currency: 'INR' } },
  validityDays: 365,
  access: {
    accessMode: 'entitlement_only',
    inheritedPlanIds,
    communityAccess: true,
  },
});

const createPodcast = (overrides = {}) => Podcast.create({
  title: 'Premium Podcast',
  description: 'Members-only podcast',
  host: 'Test Host',
  source: 'local',
  videoUrl: 'https://example.com/audio.mp3',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  duration: '10:00',
  category: 'Meditation',
  accessType: 'membership',
  ...overrides,
});

const activateMembership = async (userId, plan, source = 'purchase') => {
  await UserMembership.create({
    userId,
    planId: plan._id,
    planSnapshot: {
      title: plan.title,
      slug: plan.slug,
      pricing: { amount: 1000, currency: 'INR', type: 'one_time' },
    },
    status: 'active',
    source,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    payment: source === 'purchase'
      ? { provider: 'razorpay', amount: 1000, currency: 'INR', orderId: `order_${Date.now()}`, paymentId: `pay_${Date.now()}` }
      : { provider: 'manual', amount: 0, currency: 'INR' },
  });
};

describe('Podcast access and purchases', () => {
  it('allows a higher-tier member to access a lower-tier podcast', async () => {
    const bronze = await createPlan('podcast-bronze', 1);
    const copper = await createPlan('podcast-copper', 2, [bronze._id]);
    const silver = await createPlan('podcast-silver', 3, [copper._id]);
    const podcast = await createPodcast({ requiredMemberships: [bronze._id] });
    const user = await createTestUser({ subscriptionPlan: 'silver', subscriptionStatus: 'active' });
    await activateMembership(user._id, silver);
    const token = generateUserToken(user._id);

    const res = await request(app)
      .get('/api/podcasts/user/accessible')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    const found = res.body.data.podcasts.find((item) => item._id === String(podcast._id));
    expect(found).toBeTruthy();
    expect(found.canAccess).toBe(true);
    expect(found.videoUrl).toBeTruthy();
  });

  it('allows access through any one of multiple active memberships', async () => {
    const bronze = await createPlan('podcast-multi-bronze', 1);
    const silver = await createPlan('podcast-multi-silver', 2);
    const podcast = await createPodcast({ requiredMemberships: [bronze._id] });
    const user = await createTestUser({ subscriptionPlan: 'silver', subscriptionStatus: 'active' });
    await activateMembership(user._id, bronze);
    await activateMembership(user._id, silver);
    const token = generateUserToken(user._id);

    const res = await request(app)
      .get('/api/podcasts/user/accessible')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    const found = res.body.data.podcasts.find((item) => item._id === String(podcast._id));
    expect(found?.canAccess).toBe(true);
  });

  it('denies a lower-tier member access to a higher-tier podcast', async () => {
    const bronze = await createPlan('podcast-deny-bronze', 1);
    const silver = await createPlan('podcast-deny-silver', 2);
    const podcast = await createPodcast({ requiredMemberships: [silver._id] });
    const user = await createTestUser({ subscriptionPlan: 'bronze', subscriptionStatus: 'active' });
    await activateMembership(user._id, bronze);
    const token = generateUserToken(user._id);

    const res = await request(app)
      .get('/api/podcasts/user/accessible')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    const found = res.body.data.podcasts.find((item) => item._id === String(podcast._id));
    expect(found).toBeTruthy();
    expect(found.canAccess).toBe(false);
    expect(found.videoUrl).toBeUndefined();
  });

  it('creates a paid podcast purchase from a nested payment_link webhook', async () => {
    const user = await createTestUser({ subscriptionPlan: 'free', subscriptionStatus: 'inactive' });
    const podcast = await createPodcast({
      title: 'Paid Podcast',
      accessType: 'paid',
      price: 100,
      requiredMemberships: [],
    });

    const res = await request(app)
      .post('/api/podcasts/webhook/razorpay')
      .set('x-razorpay-signature', 'test')
      .send({
        event: 'payment_link.paid',
        payload: {
          payment_link: {
            entity: {
              id: 'plink_podcast_test',
              amount: 10000,
              notes: {
                type: 'podcast',
                userId: String(user._id),
                podcastId: String(podcast._id),
              },
            },
          },
          payment: {
            entity: { id: 'pay_podcast_test' },
          },
        },
      });

    expect(res.status).toBe(200);
    const purchase = await PodcastPurchase.findOne({
      userId: user._id,
      podcastId: podcast._id,
    }).lean();
    expect(purchase).toBeTruthy();
    expect(purchase.amount).toBe(100);
    expect(purchase.currencyCode).toBe('INR');
    expect(purchase.orderId).toBe('plink_podcast_test');
  });
});
