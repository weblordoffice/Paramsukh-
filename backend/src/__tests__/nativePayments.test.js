/**
 * Native Razorpay SDK payment flows (order + verify).
 *
 * Mirrors exactly what the mobile app does after opening the native checkout:
 *   1. POST <resource>/create-order  -> { orderId, amount, currency, keyId }
 *   2. (native SDK checkout on device — simulated here with mock pay_test_* ids)
 *   3. POST <resource>/verify-payment -> signature check + fulfillment
 *
 * Runs with RAZORPAY_TEST_MODE=true (see setup.cjs), so Razorpay is fully mocked.
 */
import request from 'supertest';
import createTestApp from './app.js';
import counselingRoutes from '../routes/counseling/counselingRoute.js';
import { Donation } from '../models/donation.models.js';
import Podcast from '../models/podcast.model.js';
import PodcastPurchase from '../models/podcastPurchase.model.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import Booking from '../models/booking.models.js';
import Notification from '../models/notification.models.js';
import { Event } from '../models/event.models.js';
import { EventRegistration } from '../models/eventRegistration.models.js';
import { User } from '../models/user.models.js';
import {
  createTestUser,
  generateUserToken,
  getAuthHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
// Counseling routes are not part of the shared test app — mount them here.
app.use('/api/counseling', counselingRoutes);
setupDB();

let user;
let authHeader;

beforeEach(async () => {
  user = await createTestUser();
  const token = generateUserToken(user._id);
  authHeader = getAuthHeader(token);
});

const mockPayId = () => `pay_test_${Date.now()}${Math.floor(Math.random() * 1000)}`;

describe('Native payments - donations (/api/donations)', () => {
  it('POST /create-order rejects invalid amount', async () => {
    const res = await request(app).post('/api/donations/create-order').set(authHeader).send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /create-order returns a mock Razorpay order', async () => {
    const res = await request(app).post('/api/donations/create-order').set(authHeader).send({ amount: 501 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderId).toMatch(/^order_test_/);
    expect(res.body.data.amount).toBe(50100);
    expect(res.body.data.keyId).toBeTruthy();
  });

  it('POST /verify-payment rejects missing fields', async () => {
    const res = await request(app).post('/api/donations/verify-payment').set(authHeader).send({ amount: 501 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /verify-payment rejects a bad signature', async () => {
    const res = await request(app)
      .post('/api/donations/verify-payment')
      .set(authHeader)
      .send({ razorpay_order_id: 'order_bad', razorpay_payment_id: 'pay_bad', razorpay_signature: 'bad', amount: 501 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('full native round-trip records the donation (and is idempotent)', async () => {
    const orderRes = await request(app).post('/api/donations/create-order').set(authHeader).send({ amount: 501 });
    const orderId = orderRes.body.data.orderId;

    const verifyRes = await request(app)
      .post('/api/donations/verify-payment')
      .set(authHeader)
      .send({ razorpay_order_id: orderId, razorpay_payment_id: mockPayId(), razorpay_signature: 'test_sig', amount: 501, message: 'jest', isAnonymous: false });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);

    const donation = await Donation.findOne({ transactionId: verifyRes.body.data.transactionId });
    expect(donation).toBeTruthy();
    expect(donation.status).toBe('completed');
    expect(donation.amount).toBe(501);

    // Donation notification must be created (relatedType=donation is a valid enum)
    const notif = await Notification.findOne({ user: user._id, title: 'Donation Received' });
    expect(notif).toBeTruthy();

    // Retry with the same payment id must not duplicate
    const retryRes = await request(app)
      .post('/api/donations/verify-payment')
      .set(authHeader)
      .send({ razorpay_order_id: orderId, razorpay_payment_id: verifyRes.body.data.transactionId, razorpay_signature: 'test_sig', amount: 501 });
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.success).toBe(true);
    expect(await Donation.countDocuments({ transactionId: verifyRes.body.data.transactionId })).toBe(1);
  });
});

describe('Native payments - podcasts (/api/podcasts)', () => {
  const createPaidPodcast = () =>
    Podcast.create({
      title: 'Paid Podcast',
      description: 'A paid podcast for testing',
      host: 'Test Host',
      source: 'local',
      videoUrl: 'https://example.com/audio.mp3',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      category: 'Other',
      accessType: 'paid',
      price: 199,
    });

  it('POST /:id/create-order requires auth', async () => {
    const podcast = await createPaidPodcast();
    const res = await request(app).post(`/api/podcasts/${podcast._id}/create-order`).send({});
    expect(res.status).toBe(401);
  });

  it('full native round-trip unlocks the podcast', async () => {
    const podcast = await createPaidPodcast();

    const orderRes = await request(app).post(`/api/podcasts/${podcast._id}/create-order`).set(authHeader).send({});
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.orderId).toMatch(/^order_test_/);
    expect(orderRes.body.data.amount).toBe(19900);

    const verifyRes = await request(app)
      .post(`/api/podcasts/${podcast._id}/verify-payment`)
      .set(authHeader)
      .send({ razorpay_order_id: orderRes.body.data.orderId, razorpay_payment_id: mockPayId(), razorpay_signature: 'test_sig' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);

    const purchase = await PodcastPurchase.findOne({ userId: user._id, podcastId: podcast._id });
    expect(purchase).toBeTruthy();

    // Purchase notification must be created (correct sendNotification signature)
    const pnotif = await Notification.findOne({ user: user._id, title: 'Podcast Purchased' });
    expect(pnotif).toBeTruthy();

    // Already purchased -> create-order refuses
    const againRes = await request(app).post(`/api/podcasts/${podcast._id}/create-order`).set(authHeader).send({});
    expect(againRes.status).toBe(400);
  });

  it('POST /:id/verify-payment rejects a bad signature', async () => {
    const podcast = await createPaidPodcast();
    const res = await request(app)
      .post(`/api/podcasts/${podcast._id}/verify-payment`)
      .set(authHeader)
      .send({ razorpay_order_id: 'order_bad', razorpay_payment_id: 'pay_bad', razorpay_signature: 'bad' });
    expect(res.status).toBe(400);
  });
});

describe('Native payments - membership (/api/payments)', () => {
  const createPlan = () =>
    MembershipPlan.create({
      title: 'Test Gold',
      slug: `testgold-${Date.now()}`,
      status: 'published',
      pricing: { oneTime: { amount: 999, currency: 'INR' } },
      validityDays: 365,
    });

  it('POST /create-order rejects an unknown plan', async () => {
    const res = await request(app).post('/api/payments/create-order').set(authHeader).send({ plan: 'no-such-plan' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('full native round-trip activates the membership', async () => {
    const plan = await createPlan();

    const orderRes = await request(app).post('/api/payments/create-order').set(authHeader).send({ plan: plan.slug });
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.orderId).toMatch(/^order_test_/);
    expect(orderRes.body.data.amount).toBe(99900);

    const verifyRes = await request(app)
      .post('/api/payments/verify-membership')
      .set(authHeader)
      .send({ razorpay_order_id: orderRes.body.data.orderId, razorpay_payment_id: mockPayId(), razorpay_signature: 'test_sig', plan: plan.slug });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);

    const updated = await User.findById(user._id);
    expect(updated.subscriptionStatus).toBe('active');
    expect(updated.subscriptionPlan).toBe(plan.slug);
  });

  it('POST /verify-membership rejects a bad signature', async () => {
    const plan = await createPlan();
    const res = await request(app)
      .post('/api/payments/verify-membership')
      .set(authHeader)
      .send({ razorpay_order_id: 'order_bad', razorpay_payment_id: 'pay_bad', razorpay_signature: 'bad', plan: plan.slug });
    expect(res.status).toBe(400);
  });
});

describe('Native payments - counseling (/api/counseling + /api/payments)', () => {
  const createBooking = () =>
    Booking.create({
      user: user._id,
      counselorType: 'general',
      counselorName: 'Test Counselor',
      bookingType: 'general',
      bookingTitle: 'Test Session',
      bookingDate: new Date(Date.now() + 86400000),
      bookingTime: '10:00 AM',
      userPhone: '+919876543210',
      isFree: false,
      amount: 499,
      paymentStatus: 'pending',
    });

  it('POST /:bookingId/payment rejects missing payment details', async () => {
    const booking = await createBooking();
    const res = await request(app).post(`/api/counseling/${booking._id}/payment`).set(authHeader).send({});
    expect(res.status).toBe(400);
  });

  it('full native round-trip confirms the booking', async () => {
    const booking = await createBooking();

    const orderRes = await request(app).post('/api/payments/create-booking-order').set(authHeader).send({ bookingId: String(booking._id) });
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.orderId).toMatch(/^order_test_/);

    const verifyRes = await request(app)
      .post(`/api/counseling/${booking._id}/payment`)
      .set(authHeader)
      .send({ razorpay_order_id: orderRes.body.data.orderId, razorpay_payment_id: mockPayId(), razorpay_signature: 'test_sig' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);

    const updated = await Booking.findById(booking._id);
    expect(updated.paymentStatus).toBe('paid');
    expect(updated.status).toBe('confirmed');
  });
});

describe('Native payments - events (/api/events)', () => {
  const createPaidEvent = () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    return Event.create({
      title: 'Paid Test Event',
      description: 'A paid event for testing',
      slug: `paid-event-${Date.now()}`,
      eventDate: future,
      eventTime: '10:00 AM',
      startTime: future,
      location: 'Online',
      locationType: 'online',
      category: 'workshop',
      isPaid: true,
      price: 299,
      status: 'upcoming',
      isActive: true,
    });
  };

  it('full native round-trip confirms the registration', async () => {
    const event = await createPaidEvent();

    const orderRes = await request(app)
      .post(`/api/events/${event._id}/register/order`)
      .set(authHeader)
      .send({ name: 'Test User', email: 'test@example.com', phone: '+919876543210' });
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.razorpay.orderId).toMatch(/^order_test_/);

    const verifyRes = await request(app)
      .post(`/api/events/${event._id}/register/confirm`)
      .set(authHeader)
      .send({ razorpay_order_id: orderRes.body.data.razorpay.orderId, razorpay_payment_id: mockPayId(), razorpay_signature: 'test_sig' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);

    const registration = await EventRegistration.findOne({ userId: user._id, eventId: event._id });
    expect(registration.status).toBe('confirmed');
    expect(registration.paymentStatus).toBe('completed');
  });

  it('POST /register/confirm rejects a bad signature', async () => {
    const event = await createPaidEvent();
    const res = await request(app)
      .post(`/api/events/${event._id}/register/confirm`)
      .set(authHeader)
      .send({ razorpay_order_id: 'order_bad', razorpay_payment_id: 'pay_bad', razorpay_signature: 'bad' });
    expect(res.status).toBe(400);
  });
});

describe('Native payments - orders (/api/orders)', () => {
  it('POST /verify-payment rejects missing fields', async () => {
    const res = await request(app).post('/api/orders/verify-payment').set(authHeader).send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /verify-payment rejects a bad signature', async () => {
    const res = await request(app)
      .post('/api/orders/verify-payment')
      .set(authHeader)
      .send({ orderId: '000000000000000000000000', razorpayPaymentId: 'pay_bad', razorpayOrderId: 'order_bad', razorpaySignature: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
