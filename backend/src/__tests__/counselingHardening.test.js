import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import Booking from '../models/booking.models.js';
import CounselingService from '../models/counselingService.model.js';
import CounselorAvailabilityException from '../models/counselorAvailabilityException.model.js';
import Notification from '../models/notification.models.js';
import { cleanupExpiredBookings } from '../services/bookingCleanup.service.js';
import { sendBookingReminders } from '../services/counselingCron.service.js';
import { startOfUtcDay } from '../utils/timezone.js';
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
const pad = (value) => String(value).padStart(2, '0');

const allDayHours = () => Object.fromEntries(
  ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((day) => [
    day,
    { start: '00:00', end: '23:00', isActive: true, breakStart: null, breakEnd: null },
  ])
);

const createService = (overrides = {}) => CounselingService.create({
  title: `Counseling ${unique()}`,
  description: 'Hardening test service',
  duration: '60 mins',
  price: 0,
  isFree: false,
  intervalMinutes: 60,
  timezone: 'Asia/Kolkata',
  isActive: true,
  counselorName: 'Test Counselor',
  businessHours: allDayHours(),
  ...overrides,
});

/** A future (or past) wall-clock slot in Asia/Kolkata. */
const slotAt = (hoursAhead) => {
  const target = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(target).map((part) => [part.type, part.value])
  );
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${pad(Number(parts.hour) % 24)}:00`,
  };
};

const makeUsers = async () => {
  const userA = await createTestUser({ email: `cns-a-${unique()}@test.com` });
  const userB = await createTestUser2({ email: `cns-b-${unique()}@test.com` });
  await createTestDeviceSession(userB._id);
  return {
    userA,
    userB,
    tokenA: generateUserToken(userA._id),
    tokenB: generateUserToken(userB._id),
  };
};

const bookSession = (token, serviceId, slot, extra = {}) =>
  request(app)
    .post('/api/counseling/book')
    .set(getAuthHeader(token))
    .send({
      counselorType: serviceId,
      bookingTitle: 'Test Session',
      bookingDate: slot.dateKey,
      bookingTime: slot.time,
      amount: 0,
      ...extra,
    });

const payBooking = async (token, bookingId) => {
  const orderRes = await request(app)
    .post('/api/payments/create-booking-order')
    .set(getAuthHeader(token))
    .send({ bookingId });
  expect(orderRes.status).toBe(200);

  const paymentRes = await request(app)
    .post(`/api/counseling/${bookingId}/payment`)
    .set(getAuthHeader(token))
    .send({
      razorpay_order_id: orderRes.body.data.orderId,
      razorpay_payment_id: `pay_test_${Date.now()}`,
      razorpay_signature: 'test_signature',
    });

  return { orderRes, paymentRes, orderId: orderRes.body.data.orderId };
};

describe('Counseling hardening', () => {
  describe('slots and dates', () => {
    it('allows a same-day future slot and rejects past slots', async () => {
      const { tokenA } = await makeUsers();
      const service = await createService();

      const future = slotAt(5);
      const ok = await bookSession(tokenA, service._id, future);
      expect(ok.status).toBe(201);

      const past = slotAt(-5);
      const rejected = await bookSession(tokenA, service._id, past);
      expect(rejected.status).toBe(400);
    });

    it('excludes an existing booking when availability is queried by service id', async () => {
      const { tokenA, tokenB } = await makeUsers();
      const service = await createService();
      const slot = slotAt(5);

      expect((await bookSession(tokenA, service._id, slot)).status).toBe(201);

      const availability = await request(app)
        .get('/api/counseling/availability')
        .query({ date: slot.dateKey, counselorType: service._id.toString() })
        .set(getAuthHeader(tokenB));

      expect(availability.status).toBe(200);
      expect(availability.body.data.availableSlots).not.toContain(slot.time);
    });

    it('enforces business hours and availability exceptions', async () => {
      const { userA, tokenA } = await makeUsers();
      const service = await createService({
        businessHours: Object.fromEntries(
          ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((day) => [
            day,
            { start: '09:00', end: '10:00', isActive: true, breakStart: null, breakEnd: null },
          ])
        ),
      });
      const slot = slotAt(80);

      expect((await bookSession(tokenA, service._id, { ...slot, time: '12:00' })).status).toBe(400);
      expect((await bookSession(tokenA, service._id, { ...slot, time: '09:00' })).status).toBe(201);

      await CounselorAvailabilityException.create({
        serviceId: service._id,
        unavailableDate: startOfUtcDay(slot.dateKey),
        reason: 'holiday',
        createdBy: userA._id,
      });

      expect((await bookSession(tokenA, service._id, { ...slot, time: '09:00' })).status).toBe(400);
    });

    it('normalizes date-only and timestamp booking dates', async () => {
      const { userA, userB } = await makeUsers();
      const service = await createService();
      const slot = slotAt(80);

      await Booking.create({
        user: userA._id,
        serviceId: service._id,
        timezone: 'Asia/Kolkata',
        counselorType: service.title,
        counselorName: 'Test Counselor',
        bookingType: 'Session',
        bookingTitle: 'Session',
        bookingDate: new Date(`${slot.dateKey}T00:00:00Z`),
        bookingTime: slot.time,
        userPhone: '9999999999',
        isFree: true,
        paymentStatus: 'not_required',
        status: 'confirmed',
      });

      const duplicate = await Booking.create({
        user: userB._id,
        serviceId: service._id,
        timezone: 'Asia/Kolkata',
        counselorType: service.title,
        counselorName: 'Test Counselor',
        bookingType: 'Session',
        bookingTitle: 'Session',
        bookingDate: new Date(`${slot.dateKey}T18:45:00Z`),
        bookingTime: slot.time,
        userPhone: '9999999998',
        isFree: true,
        paymentStatus: 'not_required',
        status: 'confirmed',
      }).then(() => null).catch((error) => error);

      expect(duplicate).not.toBeNull();
      expect(duplicate.code).toBe(11000);
    });
  });

  describe('waitlist', () => {
    it('creates a waitlist entry and promotes it when the slot frees', async () => {
      const { tokenA, tokenB } = await makeUsers();
      const service = await createService();
      const slot = slotAt(80);

      const first = await bookSession(tokenA, service._id, slot);
      expect(first.status).toBe(201);

      const second = await bookSession(tokenB, service._id, slot);
      expect(second.status).toBe(200);
      expect(second.body.data.isWaitlisted).toBe(true);
      expect(second.body.data.booking.status).toBe('waitlisted');

      const firstBookingId = first.body.data.booking._id;
      const cancel = await request(app)
        .patch(`/api/counseling/${firstBookingId}/cancel`)
        .set(getAuthHeader(tokenA))
        .send({ reason: 'test' });
      expect(cancel.status).toBe(200);

      const promoted = await Booking.findById(second.body.data.booking._id);
      // Free service → promotion confirms immediately.
      expect(promoted.status).toBe('confirmed');
      expect(promoted.waitlistRank).toBeNull();
    });
  });

  describe('cancellation and refunds', () => {
    it('refunds the booking amount in rupees exactly once', async () => {
      const { tokenA } = await makeUsers();
      const service = await createService({ price: 500, isFree: false });
      const slot = slotAt(80);

      const booked = await bookSession(tokenA, service._id, slot);
      expect(booked.status).toBe(201);
      const bookingId = booked.body.data.booking._id;

      const { paymentRes } = await payBooking(tokenA, bookingId);
      expect(paymentRes.status).toBe(200);

      const cancel = await request(app)
        .patch(`/api/counseling/${bookingId}/cancel`)
        .set(getAuthHeader(tokenA))
        .send({ reason: 'test' });
      expect(cancel.status).toBe(200);
      expect(cancel.body.refundStatus).toBe('processed');

      const stored = await Booking.findById(bookingId);
      expect(stored.refundStatus).toBe('processed');
      expect(stored.refundAmount).toBe(500);
      expect(stored.refundId).toMatch(/^rfnd_test_/);
      expect(stored.paymentStatus).toBe('refunded');

      const second = await request(app)
        .patch(`/api/counseling/${bookingId}/cancel`)
        .set(getAuthHeader(tokenA))
        .send({});
      expect(second.status).toBe(400);
    });

    it('rejects cancellation inside the 24-hour window', async () => {
      const { tokenA } = await makeUsers();
      const service = await createService({ price: 300, isFree: false });
      const slot = slotAt(2);

      const booked = await bookSession(tokenA, service._id, slot);
      expect(booked.status).toBe(201);
      const bookingId = booked.body.data.booking._id;
      await payBooking(tokenA, bookingId);

      const cancel = await request(app)
        .patch(`/api/counseling/${bookingId}/cancel`)
        .set(getAuthHeader(tokenA))
        .send({});
      expect(cancel.status).toBe(400);
      expect(cancel.body.message).toContain('24 hours');
    });

    it('admin refunds are idempotent', async () => {
      const { tokenA } = await makeUsers();
      const service = await createService({ price: 250, isFree: false });
      const slot = slotAt(80);

      const booked = await bookSession(tokenA, service._id, slot);
      const bookingId = booked.body.data.booking._id;
      await payBooking(tokenA, bookingId);

      const first = await request(app)
        .post(`/api/counseling/admin/${bookingId}/refund`)
        .set(getAdminApiKeyHeader())
        .send({ reason: 'admin test' });
      expect(first.status).toBe(200);

      const second = await request(app)
        .post(`/api/counseling/admin/${bookingId}/refund`)
        .set(getAdminApiKeyHeader())
        .send({ reason: 'admin test' });
      expect(second.status).toBe(200);
      expect(second.body.message).toContain('already');
    });
  });

  describe('payments', () => {
    it('binds the order to the booking and rejects a cancelled booking', async () => {
      const { tokenA } = await makeUsers();
      const service = await createService({ price: 200, isFree: false });
      const slot = slotAt(80);

      const booked = await bookSession(tokenA, service._id, slot);
      const bookingId = booked.body.data.booking._id;

      const orderRes = await request(app)
        .post('/api/payments/create-booking-order')
        .set(getAuthHeader(tokenA))
        .send({ bookingId });
      expect(orderRes.status).toBe(200);

      const stored = await Booking.findById(bookingId);
      expect(stored.razorpayOrderId).toBe(orderRes.body.data.orderId);

      await request(app)
        .patch(`/api/counseling/${bookingId}/cancel`)
        .set(getAuthHeader(tokenA))
        .send({});

      const paymentRes = await request(app)
        .post(`/api/counseling/${bookingId}/payment`)
        .set(getAuthHeader(tokenA))
        .send({
          razorpay_order_id: orderRes.body.data.orderId,
          razorpay_payment_id: `pay_test_${Date.now()}`,
          razorpay_signature: 'test_signature',
        });

      expect(paymentRes.status).toBe(400);
    });

    it('reuses a valid payment link and recreates an expired one', async () => {
      const { tokenA } = await makeUsers();
      const service = await createService({ price: 200, isFree: false });
      const slot = slotAt(80);

      const booked = await bookSession(tokenA, service._id, slot);
      const bookingId = booked.body.data.booking._id;

      const first = await request(app)
        .post('/api/payments/booking-link')
        .set(getAuthHeader(tokenA))
        .send({ bookingId });
      expect(first.status).toBe(200);

      const second = await request(app)
        .post('/api/payments/booking-link')
        .set(getAuthHeader(tokenA))
        .send({ bookingId });
      expect(second.body.data.paymentLinkId).toBe(first.body.data.paymentLinkId);

      await Booking.updateOne(
        { _id: bookingId },
        { $set: { paymentLinkExpiresAt: new Date(Date.now() - 60000) } }
      );

      const third = await request(app)
        .post('/api/payments/booking-link')
        .set(getAuthHeader(tokenA))
        .send({ bookingId });
      expect(third.status).toBe(200);
      expect(third.body.data.paymentLinkId).not.toBe(first.body.data.paymentLinkId);
    });
  });

  describe('reschedule', () => {
    it('rejects a taken target and keeps the request pending', async () => {
      const { tokenA, tokenB } = await makeUsers();
      const service = await createService();
      const slot = slotAt(80);

      const bookedA = await bookSession(tokenA, service._id, { ...slot, time: '09:00' });
      const bookingA = bookedA.body.data.booking._id;
      const bookedB = await bookSession(tokenB, service._id, { ...slot, time: '10:00' });
      expect(bookedB.status).toBe(201);

      const requestRes = await request(app)
        .post(`/api/counseling/${bookingA}/reschedule-request`)
        .set(getAuthHeader(tokenA))
        .send({ newDate: slot.dateKey, newTime: '10:00', reason: 'test' });
      expect(requestRes.status).toBe(409);

      const requestOk = await request(app)
        .post(`/api/counseling/${bookingA}/reschedule-request`)
        .set(getAuthHeader(tokenA))
        .send({ newDate: slot.dateKey, newTime: '11:00', reason: 'test' });
      expect(requestOk.status).toBe(200);

      // Another user takes 11:00 before admin approval.
      const taken = await bookSession(tokenB, service._id, { ...slot, time: '11:00' });
      expect(taken.status).toBe(201);

      const approve = await request(app)
        .post(`/api/counseling/admin/${bookingA}/reschedule-respond`)
        .set(getAdminApiKeyHeader())
        .send({ action: 'approve' });
      expect(approve.status).toBe(409);

      const stored = await Booking.findById(bookingA);
      expect(stored.rescheduleRequest.status).toBe('pending');
    });

    it('resets reminder flags after a direct reschedule', async () => {
      const { tokenA } = await makeUsers();
      const service = await createService();
      const slot = slotAt(80);

      const booked = await bookSession(tokenA, service._id, { ...slot, time: '09:00' });
      const bookingId = booked.body.data.booking._id;
      await Booking.updateOne(
        { _id: bookingId },
        { $set: { reminder24SentAt: new Date(), reminder1SentAt: new Date() } }
      );

      const res = await request(app)
        .patch(`/api/counseling/${bookingId}/reschedule`)
        .set(getAuthHeader(tokenA))
        .send({ newDate: slot.dateKey, newTime: '12:00', reason: 'move' });
      expect(res.status).toBe(200);

      const stored = await Booking.findById(bookingId);
      expect(stored.bookingTime).toBe('12:00');
      expect(stored.reminder24SentAt).toBeNull();
      expect(stored.reminder1SentAt).toBeNull();
    });
  });

  describe('crons', () => {
    it('sends 24h and 1h reminders using the slot time, not midnight', async () => {
      const { userA } = await makeUsers();
      const service = await createService();

      const bookings = [];
      for (const hours of [24, 1]) {
        const slot = slotAt(hours);
        bookings.push(await Booking.create({
          user: userA._id,
          serviceId: service._id,
          timezone: 'Asia/Kolkata',
          counselorType: service.title,
          counselorName: 'Test Counselor',
          bookingType: 'Session',
          bookingTitle: 'Session',
          bookingDate: startOfUtcDay(slot.dateKey),
          bookingTime: slot.time,
          userPhone: '9999999999',
          isFree: true,
          paymentStatus: 'not_required',
          status: 'confirmed',
        }));
      }

      await sendBookingReminders();

      const dayBooking = await Booking.findById(bookings[0]._id);
      const hourBooking = await Booking.findById(bookings[1]._id);
      expect(dayBooking.reminder24SentAt).not.toBeNull();
      expect(hourBooking.reminder1SentAt).not.toBeNull();
      expect(await Notification.countDocuments({ type: 'counseling_reminder' })).toBeGreaterThanOrEqual(2);
    });

    it('cancels failed pending bookings and frees the slot', async () => {
      const { userA, tokenB } = await makeUsers();
      const service = await createService({ price: 100, isFree: false });
      const slot = slotAt(80);

      const booking = await Booking.create({
        user: userA._id,
        serviceId: service._id,
        timezone: 'Asia/Kolkata',
        counselorType: service.title,
        counselorName: 'Test Counselor',
        bookingType: 'Session',
        bookingTitle: 'Session',
        bookingDate: startOfUtcDay(slot.dateKey),
        bookingTime: slot.time,
        userPhone: '9999999999',
        isFree: false,
        amount: 100,
        paymentStatus: 'failed',
        status: 'pending',
      });
      await Booking.collection.updateOne(
        { _id: booking._id },
        { $set: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } }
      );

      const result = await cleanupExpiredBookings();
      expect(result.cleaned).toBeGreaterThanOrEqual(1);

      const stored = await Booking.findById(booking._id);
      expect(stored.status).toBe('cancelled');

      const rebook = await bookSession(tokenB, service._id, slot);
      expect(rebook.status).toBe(201);
    });
  });

  describe('admin safety', () => {
    it('rejects invalid statuses and illegal transitions', async () => {
      const { tokenA } = await makeUsers();
      const service = await createService();
      const slot = slotAt(80);
      const booked = await bookSession(tokenA, service._id, slot);
      const bookingId = booked.body.data.booking._id;

      const invalid = await request(app)
        .patch(`/api/counseling/admin/${bookingId}/status`)
        .set(getAdminApiKeyHeader())
        .send({ status: 'banana' });
      expect(invalid.status).toBe(400);

      const illegal = await request(app)
        .patch(`/api/counseling/admin/${bookingId}/status`)
        .set(getAdminApiKeyHeader())
        .send({ status: 'pending' });
      expect(illegal.status).toBe(400);
    });

    it('blocks deleting a service with active bookings', async () => {
      const { tokenA } = await makeUsers();
      const service = await createService();
      await bookSession(tokenA, service._id, slotAt(80));

      const res = await request(app)
        .delete(`/api/counseling/admin/services/${service._id}`)
        .set(getAdminApiKeyHeader());

      expect(res.status).toBe(409);
    });

    it('rejects past and duplicate availability exceptions', async () => {
      const service = await createService();
      const past = slotAt(-80);

      const pastRes = await request(app)
        .post('/api/counseling/admin/availability-exceptions')
        .set(getAdminApiKeyHeader())
        .send({ serviceId: service._id, unavailableDate: past.dateKey, reason: 'other' });
      expect(pastRes.status).toBe(400);

      const future = slotAt(80);
      const first = await request(app)
        .post('/api/counseling/admin/availability-exceptions')
        .set(getAdminApiKeyHeader())
        .send({ serviceId: service._id, unavailableDate: future.dateKey, reason: 'holiday' });
      expect(first.status).toBe(201);

      const duplicate = await request(app)
        .post('/api/counseling/admin/availability-exceptions')
        .set(getAdminApiKeyHeader())
        .send({ serviceId: service._id, unavailableDate: future.dateKey, reason: 'holiday' });
      expect(duplicate.status).toBe(400);
    });
  });
});
