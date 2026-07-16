import request from 'supertest';
import createTestApp from './app.js';
import { Event } from '../models/event.models.js';
import {
  createTestUser,
  generateUserToken,
  getAuthHeader,
  getAdminApiKeyHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

const createTestEvent = async (overrides = {}) => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  const event = await Event.create({
    title: 'Test Event',
    description: 'A test event for automated testing',
    slug: `test-event-${Date.now()}`,
    eventDate: futureDate,
    eventTime: '10:00 AM',
    startTime: futureDate,
    location: 'Online',
    locationType: 'online',
    category: 'workshop',
    maxParticipants: 100,
    isPaid: false,
    status: 'upcoming',
    ...overrides,
  });
  return event;
};

describe('Events Module - /api/events', () => {
  describe('GET /api/events/all', () => {
    it('should return list of events', async () => {
      await createTestEvent();
      await createTestEvent({ slug: `test-event-${Date.now() + 1}` });

      const res = await request(app).get('/api/events/all');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no events', async () => {
      const res = await request(app).get('/api/events/all');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events).toEqual([]);
    });
  });

  describe('GET /api/events/upcoming', () => {
    it('should return only upcoming events', async () => {
      await createTestEvent();

      const res = await request(app).get('/api/events/upcoming');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/events/past', () => {
    it('should return past events', async () => {
      const pastDate = new Date('2020-01-01');
      await createTestEvent({ eventDate: pastDate, slug: 'past-event' });

      const res = await request(app).get('/api/events/past');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/events/slug/:slug', () => {
    it('should return event by slug', async () => {
      await createTestEvent({ slug: 'my-event-slug' });

      const res = await request(app).get('/api/events/slug/my-event-slug');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.event.slug).toBe('my-event-slug');
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app).get('/api/events/slug/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/events/:id', () => {
    it('should return event by ID', async () => {
      const event = await createTestEvent();

      const res = await request(app).get(`/api/events/${event._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.event.title).toBe('Test Event');
    });
  });

  describe('POST /api/events/create', () => {
    it('should create event with admin auth', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const res = await request(app)
        .post('/api/events/create')
        .set(getAdminApiKeyHeader())
        .send({
          title: 'New Event',
          description: 'A new test event',
          eventDate: futureDate.toISOString(),
          eventTime: '5:00 PM',
          startTime: futureDate.toISOString(),
          location: 'Test Venue',
          locationType: 'physical',
          category: 'workshop',
          maxParticipants: 50,
          isPaid: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.event.title).toBe('New Event');
    });

    it('should reject without admin auth', async () => {
      const res = await request(app)
        .post('/api/events/create')
        .send({ title: 'Unauthorized Event' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Event Registration', () => {
    let user;
    let token;
    let event;

    beforeEach(async () => {
      user = await createTestUser({ assessmentCompleted: true });
      token = generateUserToken(user._id);
      event = await createTestEvent();
    });

    it('POST /:eventId/register — should register user for event', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/register`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('GET /my-registrations — should return user registrations', async () => {
      await request(app)
        .post(`/api/events/${event._id}/register`)
        .set(getAuthHeader(token));

      const res = await request(app)
        .get('/api/events/my-registrations')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /:eventId/register — should reject without auth', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/register`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
