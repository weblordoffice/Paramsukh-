import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { Event } from '../models/event.models.js';
import { EventRegistration } from '../models/eventRegistration.models.js';
import Coupon from '../models/coupon.models.js';
import CouponUsage from '../models/couponUsage.models.js';
import { User } from '../models/user.models.js';
import { expireAbandonedRegistrations, refreshEventStatuses } from '../services/eventCron.service.js';
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

const DAY = 24 * 60 * 60 * 1000;
const unique = () => `${Date.now()}${Math.floor(Math.random() * 10000)}`;

const createEvent = (overrides = {}) => {
  const start = overrides.startTime || new Date(Date.now() + 7 * DAY);
  return Event.create({
    title: `Hardening Event ${unique()}`,
    description: 'Event hardening test fixture',
    slug: `hardening-${unique()}`,
    eventDate: start,
    eventTime: '10:00 AM',
    startTime: start,
    endTime: new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000),
    location: 'Online',
    locationType: 'physical',
    category: 'workshop',
    isPaid: false,
    maxAttendees: null,
    ...overrides,
  });
};

const makeUsers = async () => {
  const userA = await createTestUser({ email: `evt-a-${unique()}@test.com` });
  const userB = await createTestUser2({ email: `evt-b-${unique()}@test.com` });
  await createTestDeviceSession(userB._id);
  return {
    userA,
    userB,
    tokenA: generateUserToken(userA._id),
    tokenB: generateUserToken(userB._id),
  };
};

const payAndConfirm = async (eventId, token) => {
  const orderRes = await request(app)
    .post(`/api/events/${eventId}/register/order`)
    .set(getAuthHeader(token))
    .send({});
  expect(orderRes.status).toBe(200);

  const orderId = orderRes.body.data.razorpay.orderId;
  const confirmRes = await request(app)
    .post(`/api/events/${eventId}/register/confirm`)
    .set(getAuthHeader(token))
    .send({
      razorpay_order_id: orderId,
      razorpay_payment_id: `pay_test_${Date.now()}`,
      razorpay_signature: 'test_signature',
    });

  return { orderRes, confirmRes, orderId };
};

describe('Events hardening', () => {
  describe('capacity', () => {
    it('prevents overselling and never leaves reserved seats behind', async () => {
      const { userA, tokenA, userB, tokenB } = await makeUsers();
      const event = await createEvent({ maxAttendees: 1, registrationRequired: true });

      const first = await request(app)
        .post(`/api/events/${event._id}/register`)
        .set(getAuthHeader(tokenA))
        .send({});
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/events/${event._id}/register`)
        .set(getAuthHeader(tokenB))
        .send({});
      expect(second.status).toBe(400);
      expect(second.body.reason).toBe('Event is full');

      const stored = await Event.findById(event._id);
      expect(stored.currentAttendees).toBe(1);
      expect(stored.reservedSeats).toBe(0);
      expect(await EventRegistration.countDocuments({ eventId: event._id, status: 'confirmed' })).toBe(1);
      expect(userA).toBeTruthy();
      expect(userB).toBeTruthy();
    });

    it('reports spotsLeft including reserved seats and clamps at zero', async () => {
      const event = await createEvent({ maxAttendees: 3 });
      await Event.updateOne({ _id: event._id }, { $set: { currentAttendees: 1, reservedSeats: 1 } });

      const res = await request(app).get(`/api/events/${event._id}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.spotsLeft).toBe(1);
      expect(res.body.meta.isFull).toBe(false);

      await Event.updateOne({ _id: event._id }, { $set: { currentAttendees: 2, reservedSeats: 2 } });
      const full = await request(app).get(`/api/events/${event._id}`);
      expect(full.body.meta.spotsLeft).toBe(0);
      expect(full.body.meta.isFull).toBe(true);
    });
  });

  describe('payment confirmation', () => {
    it('is idempotent and generates exactly one ticket', async () => {
      const { userA, tokenA } = await makeUsers();
      const event = await createEvent({ isPaid: true, price: 100, maxAttendees: 5 });

      const { orderId } = await payAndConfirm(event._id, tokenA).then(async (result) => {
        expect(result.confirmRes.status).toBe(200);
        expect(result.confirmRes.body.registration.ticketId).toMatch(/^EVT-/);
        return result;
      });

      const replay = await request(app)
        .post(`/api/events/${event._id}/register/confirm`)
        .set(getAuthHeader(tokenA))
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: `pay_test_replay_${Date.now()}`,
          razorpay_signature: 'test_signature',
        });

      expect(replay.status).toBe(200);
      expect(replay.body.registration.ticketId).toMatch(/^EVT-/);

      const registration = await EventRegistration.findOne({ userId: userA._id, eventId: event._id });
      expect(registration.status).toBe('confirmed');
      expect(registration.seatReserved).toBe(false);

      const storedEvent = await Event.findById(event._id);
      expect(storedEvent.currentAttendees).toBe(1);
      expect(storedEvent.reservedSeats).toBe(0);

      const storedUser = await User.findById(userA._id);
      expect((storedUser.payments || []).filter((p) => p.orderId === orderId)).toHaveLength(1);
    });

    it('confirms payment links idempotently with a ticket', async () => {
      const { tokenA } = await makeUsers();
      const event = await createEvent({ isPaid: true, price: 50, maxAttendees: 5 });

      const linkRes = await request(app)
        .post(`/api/events/${event._id}/register/link`)
        .set(getAuthHeader(tokenA))
        .send({});
      expect(linkRes.status).toBe(200);
      const linkId = linkRes.body.data.paymentLinkId;

      const first = await request(app)
        .post(`/api/events/${event._id}/register/confirm-link`)
        .set(getAuthHeader(tokenA))
        .send({ paymentLinkId: linkId });
      expect(first.status).toBe(200);
      expect(first.body.data.registration.ticketId).toMatch(/^EVT-/);

      const second = await request(app)
        .post(`/api/events/${event._id}/register/confirm-link`)
        .set(getAuthHeader(tokenA))
        .send({ paymentLinkId: linkId });
      expect(second.status).toBe(200);
      expect(second.body.data.registration.ticketId).toBe(first.body.data.registration.ticketId);
    });

    it('rounds discounted amounts to whole paise', async () => {
      const { userA, tokenA } = await makeUsers();
      const event = await createEvent({ isPaid: true, price: 999 });

      const coupon = await Coupon.create({
        code: `TEN${unique()}`,
        description: '10 percent',
        discountType: 'percentage',
        discountValue: 10,
        purchaseTypes: ['event'],
        userRestriction: 'specific',
        applicableUsers: [userA._id],
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(Date.now() + DAY),
        isActive: true,
      });

      const order = await request(app)
        .post(`/api/events/${event._id}/register/order`)
        .set(getAuthHeader(tokenA))
        .send({ couponCode: coupon.code });

      expect(order.status).toBe(200);
      expect(order.body.data.razorpay.discountAmount).toBe(99.9);
      expect(order.body.data.razorpay.amount).toBe(89910);
    });

    it('rejects the free register endpoint for paid events', async () => {
      const { tokenA } = await makeUsers();
      const event = await createEvent({ isPaid: true, price: 200 });

      const res = await request(app)
        .post(`/api/events/${event._id}/register`)
        .set(getAuthHeader(tokenA))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('paid event');
    });
  });

  describe('cancellation and refunds', () => {
    it('refunds a paid registration and reverts coupon usage', async () => {
      const { userA, tokenA } = await makeUsers();
      const event = await createEvent({ isPaid: true, price: 500, maxAttendees: 5 });

      const coupon = await Coupon.create({
        code: `FLAT${unique()}`,
        description: 'Flat 100',
        discountType: 'flat',
        discountValue: 100,
        purchaseTypes: ['event'],
        userRestriction: 'specific',
        applicableUsers: [userA._id],
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(Date.now() + DAY),
        isActive: true,
        maxUsagePerUser: 1,
      });

      const order = await request(app)
        .post(`/api/events/${event._id}/register/order`)
        .set(getAuthHeader(tokenA))
        .send({ couponCode: coupon.code });
      expect(order.status).toBe(200);

      const confirm = await request(app)
        .post(`/api/events/${event._id}/register/confirm`)
        .set(getAuthHeader(tokenA))
        .send({
          razorpay_order_id: order.body.data.razorpay.orderId,
          razorpay_payment_id: `pay_test_${Date.now()}`,
          razorpay_signature: 'test_signature',
        });
      expect(confirm.status).toBe(200);

      expect(await CouponUsage.countDocuments({ coupon: coupon._id, user: userA._id })).toBe(1);
      expect((await Coupon.findById(coupon._id)).currentUsageCount).toBe(1);

      const cancel = await request(app)
        .delete(`/api/events/${event._id}/register`)
        .set(getAuthHeader(tokenA));

      expect(cancel.status).toBe(200);
      expect(cancel.body.refundStatus).toBe('processed');

      const registration = await EventRegistration.findOne({ userId: userA._id, eventId: event._id });
      expect(registration.status).toBe('cancelled');
      expect(registration.paymentStatus).toBe('refunded');
      expect(registration.refundStatus).toBe('processed');
      expect(registration.refundId).toMatch(/^rfnd_test_/);

      expect(await CouponUsage.countDocuments({ coupon: coupon._id })).toBe(0);
      const storedCoupon = await Coupon.findById(coupon._id);
      expect(storedCoupon.currentUsageCount).toBe(0);
      expect(storedCoupon.stats.totalUsed).toBe(0);

      const storedEvent = await Event.findById(event._id);
      expect(storedEvent.currentAttendees).toBe(0);
      expect(storedEvent.reservedSeats).toBe(0);
    });

    it('releases a pending seat when cancelling', async () => {
      const { userA, tokenA } = await makeUsers();
      const event = await createEvent({ isPaid: true, price: 300, maxAttendees: 2 });

      const order = await request(app)
        .post(`/api/events/${event._id}/register/order`)
        .set(getAuthHeader(tokenA))
        .send({});
      expect(order.status).toBe(200);

      let storedEvent = await Event.findById(event._id);
      expect(storedEvent.reservedSeats).toBe(1);

      const cancel = await request(app)
        .delete(`/api/events/${event._id}/register`)
        .set(getAuthHeader(tokenA));
      expect(cancel.status).toBe(200);

      storedEvent = await Event.findById(event._id);
      expect(storedEvent.reservedSeats).toBe(0);
    });

    it('blocks cancellation after start and for attended registrations', async () => {
      const { userA, userB, tokenA, tokenB } = await makeUsers();
      const event = await createEvent({ maxAttendees: 5 });

      await EventRegistration.create({
        userId: userA._id,
        eventId: event._id,
        status: 'confirmed',
        paymentStatus: 'completed',
      });
      await Event.updateOne({ _id: event._id }, { $set: { startTime: new Date(Date.now() - DAY) } });

      const late = await request(app)
        .delete(`/api/events/${event._id}/register`)
        .set(getAuthHeader(tokenA));
      expect(late.status).toBe(400);
      expect(late.body.message).toContain('started');

      const event2 = await createEvent({ maxAttendees: 5 });
      await EventRegistration.create({
        userId: userB._id,
        eventId: event2._id,
        status: 'attended',
        paymentStatus: 'completed',
        checkedIn: true,
      });

      const attended = await request(app)
        .delete(`/api/events/${event2._id}/register`)
        .set(getAuthHeader(tokenB));
      expect(attended.status).toBe(400);
      expect(attended.body.message).toContain('Attended');
    });
  });

  describe('cron jobs', () => {
    it('expires abandoned pending registrations, releases seats, and reverts discounts', async () => {
      const { userA } = await makeUsers();
      const event = await createEvent({ maxAttendees: 2 });

      const stale = await EventRegistration.create({
        userId: userA._id,
        eventId: event._id,
        status: 'pending',
        paymentStatus: 'pending',
        seatReserved: true,
      });
      await Event.updateOne({ _id: event._id }, { $set: { reservedSeats: 1 } });
      await EventRegistration.collection.updateOne(
        { _id: stale._id },
        { $set: { updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) } }
      );

      const result = await expireAbandonedRegistrations();
      expect(result.cancelled).toBe(1);

      const stored = await EventRegistration.findById(stale._id);
      expect(stored.status).toBe('cancelled');
      expect(stored.paymentStatus).toBe('failed');
      expect(stored.seatReserved).toBe(false);

      const storedEvent = await Event.findById(event._id);
      expect(storedEvent.reservedSeats).toBe(0);
    });

    it('refreshes event statuses from the clock without touching cancelled events', async () => {
      const upcoming = await createEvent({ startTime: new Date(Date.now() + DAY) });
      const ongoing = await createEvent({
        startTime: new Date(Date.now() - 30 * 60 * 1000),
        endTime: new Date(Date.now() + 30 * 60 * 1000),
      });
      const past = await createEvent({
        startTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      });
      const cancelled = await createEvent({ startTime: new Date(Date.now() + DAY) });

      for (const event of [upcoming, ongoing, past]) {
        await Event.updateOne({ _id: event._id }, { $set: { status: 'upcoming' } });
      }
      await Event.updateOne({ _id: cancelled._id }, { $set: { status: 'cancelled' } });

      await refreshEventStatuses();

      expect((await Event.findById(upcoming._id)).status).toBe('upcoming');
      expect((await Event.findById(ongoing._id)).status).toBe('ongoing');
      expect((await Event.findById(past._id)).status).toBe('past');
      expect((await Event.findById(cancelled._id)).status).toBe('cancelled');
    });
  });

  describe('public exposure and validation', () => {
    it('never exposes the meeting link publicly and gates the dedicated endpoint', async () => {
      const { userA, tokenA } = await makeUsers();
      const link = 'https://meet.example.com/private-room';
      const event = await createEvent({
        locationType: 'online',
        onlineMeetingLink: link,
        maxAttendees: 5,
      });

      const detail = await request(app).get(`/api/events/${event._id}`);
      expect(detail.status).toBe(200);
      expect(detail.body.event.onlineMeetingLink).toBeUndefined();
      expect(detail.body.event.hasOnlineMeeting).toBe(true);

      const list = await request(app).get('/api/events/all');
      const listed = list.body.events.find((item) => item._id === String(event._id));
      expect(listed.onlineMeetingLink).toBeUndefined();

      const bySlug = await request(app).get(`/api/events/slug/${event.slug}`);
      expect(bySlug.body.event.onlineMeetingLink).toBeUndefined();

      const ics = await request(app).get(`/api/events/${event._id}/calendar.ics`);
      expect(ics.status).toBe(200);
      expect(ics.text).not.toContain(link);

      const noRegistration = await request(app)
        .get(`/api/events/${event._id}/meeting-link`)
        .set(getAuthHeader(tokenA));
      expect(noRegistration.status).toBe(403);

      await EventRegistration.create({
        userId: userA._id,
        eventId: event._id,
        status: 'pending',
        paymentStatus: 'pending',
      });
      const pending = await request(app)
        .get(`/api/events/${event._id}/meeting-link`)
        .set(getAuthHeader(tokenA));
      expect(pending.status).toBe(403);

      await EventRegistration.updateOne(
        { userId: userA._id, eventId: event._id },
        { $set: { status: 'confirmed', paymentStatus: 'completed' } }
      );
      const allowed = await request(app)
        .get(`/api/events/${event._id}/meeting-link`)
        .set(getAuthHeader(tokenA));
      expect(allowed.status).toBe(200);
      expect(allowed.body.url).toBe(link);
    });

    it('rejects invalid capacity, timing, pricing, and currency updates', async () => {
      const { userA, userB } = await makeUsers();
      const start = new Date(Date.now() + 7 * DAY);
      const event = await createEvent({
        isPaid: true,
        price: 100,
        maxAttendees: 5,
        startTime: start,
        endTime: new Date(start.getTime() + 2 * 60 * 60 * 1000),
      });

      await EventRegistration.create([
        { userId: userA._id, eventId: event._id, status: 'confirmed', paymentStatus: 'completed' },
        { userId: userB._id, eventId: event._id, status: 'confirmed', paymentStatus: 'completed' },
      ]);
      await Event.updateOne({ _id: event._id }, { $set: { currentAttendees: 2 } });

      const tooSmall = await request(app)
        .put(`/api/events/${event._id}`)
        .set(getAdminApiKeyHeader())
        .send({ maxAttendees: 1 });
      expect(tooSmall.status).toBe(400);
      expect(tooSmall.body.message).toContain('Capacity');

      const badTiming = await request(app)
        .put(`/api/events/${event._id}`)
        .set(getAdminApiKeyHeader())
        .send({ endTime: start.toISOString() });
      expect(badTiming.status).toBe(400);

      const badEarlyBird = await request(app)
        .put(`/api/events/${event._id}`)
        .set(getAdminApiKeyHeader())
        .send({ earlyBirdPrice: 150 });
      expect(badEarlyBird.status).toBe(400);

      const badCurrency = await request(app)
        .put(`/api/events/${event._id}`)
        .set(getAdminApiKeyHeader())
        .send({ currency: 'GBP' });
      expect(badCurrency.status).toBe(400);
    });

    it('excludes cancelled events by default and includes them on request', async () => {
      await createEvent();
      const cancelled = await createEvent();
      await Event.updateOne({ _id: cancelled._id }, { $set: { status: 'cancelled' } });

      const defaults = await request(app).get('/api/events/all');
      expect(defaults.body.events.some((item) => item._id === String(cancelled._id))).toBe(false);

      const withCancelled = await request(app).get('/api/events/all?includeCancelled=true');
      expect(withCancelled.body.events.some((item) => item._id === String(cancelled._id))).toBe(true);
    });
  });

  describe('admin cancellation', () => {
    it('refunds paid registrations when an event is cancelled and preserves attendance', async () => {
      const { userA, userB, tokenA } = await makeUsers();
      const event = await createEvent({ isPaid: true, price: 400, maxAttendees: 10 });

      await payAndConfirm(event._id, tokenA);

      await EventRegistration.create({
        userId: userB._id,
        eventId: event._id,
        status: 'attended',
        paymentStatus: 'completed',
        checkedIn: true,
        paymentAmount: 0,
      });

      const cancel = await request(app)
        .patch(`/api/events/${event._id}/cancel`)
        .set(getAdminApiKeyHeader());

      expect(cancel.status).toBe(200);
      expect(cancel.body.refundedCount).toBe(1);

      const paidRegistration = await EventRegistration.findOne({ userId: userA._id, eventId: event._id });
      expect(paidRegistration.status).toBe('cancelled');
      expect(paidRegistration.refundStatus).toBe('processed');

      const attended = await EventRegistration.findOne({ userId: userB._id, eventId: event._id });
      expect(attended.status).toBe('attended');

      const storedEvent = await Event.findById(event._id);
      expect(storedEvent.status).toBe('cancelled');
      expect(storedEvent.currentAttendees).toBe(1);
      expect(storedEvent.reservedSeats).toBe(0);
    });

    it('refuses to delete an event with paid registrations', async () => {
      const { tokenA } = await makeUsers();
      const event = await createEvent({ isPaid: true, price: 100 });
      await payAndConfirm(event._id, tokenA);

      const res = await request(app)
        .delete(`/api/events/${event._id}`)
        .set(getAdminApiKeyHeader());

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cancel the event first');
    });
  });
});
