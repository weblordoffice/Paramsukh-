import request from 'supertest';
import createTestApp from './app.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { LiveCoachingSession } from '../models/liveSession.models.js';
import {
  createTestUser,
  createTestUser2,
  createTestDeviceSession,
  generateUserToken,
  getAuthHeader,
  getAdminApiKeyHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

const futureIso = (minutes = 60) => new Date(Date.now() + minutes * 60000).toISOString();
const pastIso = (minutes = 60) => new Date(Date.now() - minutes * 60000).toISOString();

const basePayload = (overrides = {}) => ({
  title: 'Weekly Wellness Coaching',
  description: 'Live guidance with a mentor.',
  scheduledAt: futureIso(),
  durationInMinutes: 60,
  meetingPlatform: 'zoom',
  meetingLink: 'https://zoom.us/j/123456789',
  audienceType: 'all',
  planSlugs: [],
  ...overrides,
});

describe('Standalone Live Sessions', () => {
  let freeUser;
  let freeToken;

  beforeEach(async () => {
    await MembershipPlan.findOneAndUpdate(
      { slug: 'gold' },
      {
        title: 'Gold Plan',
        slug: 'gold',
        description: 'Gold membership',
        price: 4999,
        duration: 'month',
        isActive: true,
        access: { communityAccess: true, accessMode: 'entitlement_only' },
      },
      { upsert: true, new: true }
    );

    freeUser = await createTestUser({ subscriptionPlan: 'free', subscriptionStatus: 'inactive' });
    freeToken = generateUserToken(freeUser._id);
  });

  it('should show all-audience sessions to any authenticated user', async () => {
    const created = await request(app)
      .post('/api/live-sessions/admin')
      .set(getAdminApiKeyHeader())
      .send(basePayload());

    expect(created.status).toBe(201);

    const res = await request(app)
      .get('/api/live-sessions')
      .set(getAuthHeader(freeToken));

    expect(res.status).toBe(200);
    expect(res.body.upcoming.some((session) => session._id === created.body.data._id)).toBe(true);
  });

  it('should restrict plan-audience sessions to users on that plan', async () => {
    const goldUser = await createTestUser2({
      subscriptionPlan: 'gold',
      subscriptionStatus: 'active',
    });
    await createTestDeviceSession(goldUser._id);
    const goldToken = generateUserToken(goldUser._id);

    const created = await request(app)
      .post('/api/live-sessions/admin')
      .set(getAdminApiKeyHeader())
      .send(basePayload({
        title: 'Gold Members Coaching',
        audienceType: 'plans',
        planSlugs: ['gold'],
      }));

    expect(created.status).toBe(201);
    const sessionId = created.body.data._id;

    const freeRes = await request(app)
      .get('/api/live-sessions')
      .set(getAuthHeader(freeToken));
    expect(freeRes.body.upcoming.some((session) => session._id === sessionId)).toBe(false);

    const freeDetail = await request(app)
      .get(`/api/live-sessions/${sessionId}`)
      .set(getAuthHeader(freeToken));
    expect(freeDetail.status).toBe(404);

    const goldRes = await request(app)
      .get('/api/live-sessions')
      .set(getAuthHeader(goldToken));
    expect(goldRes.body.upcoming.some((session) => session._id === sessionId)).toBe(true);

    const goldDetail = await request(app)
      .get(`/api/live-sessions/${sessionId}`)
      .set(getAuthHeader(goldToken));
    expect(goldDetail.status).toBe(200);
  });

  it('should return past sessions with recordings to eligible users', async () => {
    const created = await request(app)
      .post('/api/live-sessions/admin')
      .set(getAdminApiKeyHeader())
      .send(basePayload({
        title: 'Recorded Session',
        scheduledAt: pastIso(120),
        status: 'completed',
        recordingUrl: 'https://cdn.example.com/recording.mp4',
      }));

    expect(created.status).toBe(201);

    const res = await request(app)
      .get('/api/live-sessions')
      .set(getAuthHeader(freeToken));

    expect(res.status).toBe(200);
    const session = res.body.past.find((item) => item._id === created.body.data._id);
    expect(session).toBeTruthy();
    expect(session.recordingUrl).toBe('https://cdn.example.com/recording.mp4');
  });

  it('should let an admin create, update, list, and delete a session', async () => {
    const created = await request(app)
      .post('/api/live-sessions/admin')
      .set(getAdminApiKeyHeader())
      .send(basePayload());

    expect(created.status).toBe(201);

    const updated = await request(app)
      .patch(`/api/live-sessions/admin/${created.body.data._id}`)
      .set(getAdminApiKeyHeader())
      .send({
        title: 'Updated Coaching Session',
        recordingUrl: 'https://cdn.example.com/updated.mp4',
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe('Updated Coaching Session');
    expect(updated.body.data.recordingUrl).toBe('https://cdn.example.com/updated.mp4');

    const list = await request(app)
      .get('/api/live-sessions/admin/all')
      .set(getAdminApiKeyHeader());
    expect(list.status).toBe(200);
    expect(list.body.data.some((session) => session._id === created.body.data._id)).toBe(true);

    const removed = await request(app)
      .delete(`/api/live-sessions/admin/${created.body.data._id}`)
      .set(getAdminApiKeyHeader());
    expect(removed.status).toBe(200);

    const deleted = await LiveCoachingSession.findById(created.body.data._id).lean();
    expect(deleted).toBeFalsy();
  });

  it('should reject plan-audience sessions without plans', async () => {
    const res = await request(app)
      .post('/api/live-sessions/admin')
      .set(getAdminApiKeyHeader())
      .send(basePayload({
        audienceType: 'plans',
        planSlugs: [],
      }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
