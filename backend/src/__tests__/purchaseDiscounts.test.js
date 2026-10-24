import request from 'supertest';
import mongoose from 'mongoose';
import createTestApp from './app.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { Offer } from '../models/offer.models.js';
import Coupon from '../models/coupon.models.js';
import CouponUsage from '../models/couponUsage.models.js';
import { PurchaseDiscount } from '../models/purchaseDiscount.models.js';
import { Event } from '../models/event.models.js';
import CounselingService from '../models/counselingService.model.js';
import { EventRegistration } from '../models/eventRegistration.models.js';
import Booking from '../models/booking.models.js';
import {
  applyPurchaseDiscount,
  resolvePurchaseDiscount,
} from '../services/purchaseDiscount.service.js';
import {
  createTestUser,
  generateUserToken,
  getAuthHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

const futureDate = (days = 3) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const createPlan = (slug, amount, overrides = {}) => MembershipPlan.create({
  title: slug,
  slug,
  status: 'published',
  pricing: { oneTime: { amount, currency: 'INR' } },
  validityDays: 365,
  access: { accessMode: 'entitlement_only' },
  ...overrides,
});

const createOffer = (overrides = {}) => Offer.create({
  title: 'Test offer',
  discountType: 'percentage',
  discountValue: 10,
  minOrderValue: 0,
  purchaseTypes: ['membership'],
  startDate: new Date(Date.now() - 60 * 60 * 1000),
  endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  isActive: true,
  ...overrides,
});

describe('Purchase discounts outside the shop', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await createTestUser({ subscriptionPlan: 'free', subscriptionStatus: 'inactive' });
    token = generateUserToken(user._id);
  });

  it('applies an automatic offer to a membership order for the targeted plan', async () => {
    const bronze = await createPlan('discount-bronze', 1000);
    await createOffer({ membershipPlanIds: [bronze._id], discountValue: 10 });
    await createPlan('discount-silver', 2000);

    const bronzeOrder = await request(app)
      .post('/api/payments/create-order')
      .set(getAuthHeader(token))
      .send({ plan: bronze.slug });
    expect(bronzeOrder.status).toBe(200);
    expect(bronzeOrder.body.data.baseAmount).toBe(1000);
    expect(bronzeOrder.body.data.discountAmount).toBe(100);
    expect(bronzeOrder.body.data.amount).toBe(90000);

    const silverOrder = await request(app)
      .post('/api/payments/create-order')
      .set(getAuthHeader(token))
      .send({ plan: 'discount-silver' });
    expect(silverOrder.status).toBe(200);
    expect(silverOrder.body.data.discountAmount).toBe(0);
    expect(silverOrder.body.data.amount).toBe(200000);
  });

  it('applies an automatic offer to a paid event registration', async () => {
    const start = futureDate();
    const event = await Event.create({
      title: 'Discounted Event',
      description: 'Event with an offer',
      slug: `discount-event-${Date.now()}`,
      eventDate: start,
      eventTime: '10:00 AM',
      startTime: start,
      location: 'Online',
      locationType: 'online',
      category: 'workshop',
      isPaid: true,
      price: 500,
      maxAttendees: 10,
      status: 'upcoming',
    });
    await createOffer({
      title: 'Event 10% off',
      purchaseTypes: ['event'],
      eventIds: [event._id],
      discountValue: 10,
    });

    const res = await request(app)
      .post(`/api/events/${event._id}/register/order`)
      .set(getAuthHeader(token))
      .send({ name: 'Test User', email: 'discount-event@test.com', phone: '9999999999' });

    expect(res.status).toBe(200);
    expect(res.body.data.razorpay.amount).toBe(45000);

    const registration = await EventRegistration.findOne({ userId: user._id, eventId: event._id }).lean();
    expect(registration.paymentAmount).toBe(450);
    expect(registration.discountAmount).toBe(50);
    expect(registration.offerTitle).toBe('Event 10% off');
  });

  it('requires a code for coupons, applies it to counseling, and records usage once', async () => {
    const service = await CounselingService.create({
      title: 'Discounted Counseling',
      description: 'Counseling session with a coupon',
      duration: '60 mins',
      price: 1000,
      isActive: true,
    });
    const coupon = await Coupon.create({
      code: 'COUNSEL10',
      description: '10% counseling discount',
      discountType: 'percentage',
      discountValue: 10,
      maxDiscount: null,
      minOrderValue: 0,
      purchaseTypes: ['counseling'],
      counselingServiceIds: [service._id],
      maxUsagePerUser: 1,
      startDate: new Date(Date.now() - 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isActive: true,
    });

    const bookingDate = futureDate(5).toISOString().split('T')[0];
    const bookingRes = await request(app)
      .post('/api/counseling/book')
      .set(getAuthHeader(token))
      .send({
        counselorType: String(service._id),
        counselorName: 'Expert Counselor',
        bookingType: service.title,
        bookingTitle: service.title,
        bookingDate,
        bookingTime: '10:00',
        userNotes: 'Test booking',
        couponCode: 'COUNSEL10',
        amount: 1000,
      });

    expect(bookingRes.status).toBe(201);
    const booking = bookingRes.body.data.booking;
    expect(booking.amount).toBe(900);
    expect(booking.baseAmount).toBe(1000);
    expect(booking.discountAmount).toBe(100);
    expect(booking.couponCode).toBe('COUNSEL10');

    const refreshSession = await CounselingService.findById(service._id).lean();
    expect(refreshSession).toBeTruthy();

    const orderRes = await request(app)
      .post('/api/payments/create-booking-order')
      .set(getAuthHeader(token))
      .send({ bookingId: booking._id });
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.amount).toBe(90000);

    const pending = await PurchaseDiscount.findOne({
      purchaseType: 'counseling',
      referenceId: new mongoose.Types.ObjectId(booking._id),
      status: 'pending',
    });
    expect(pending).toBeTruthy();

    await applyPurchaseDiscount({ referenceType: 'counseling', referenceId: booking._id });
    await applyPurchaseDiscount({ referenceType: 'counseling', referenceId: booking._id });

    expect(await CouponUsage.countDocuments({ coupon: coupon._id, referenceId: booking._id })).toBe(1);
    const updatedCoupon = await Coupon.findById(coupon._id).lean();
    expect(updatedCoupon.currentUsageCount).toBe(1);
    expect(updatedCoupon.stats.totalDiscount).toBe(100);
  });

  it('does not apply a counseling coupon to a shop coupon lookup', async () => {
    const service = await CounselingService.create({
      title: 'Counseling Only',
      description: 'Not a shop product',
      duration: '60 mins',
      price: 1000,
      isActive: true,
    });
    await Coupon.create({
      code: 'COUNSELONLY',
      description: 'Counseling only coupon',
      discountType: 'flat',
      discountValue: 100,
      purchaseTypes: ['counseling'],
      counselingServiceIds: [service._id],
      maxUsagePerUser: 1,
      startDate: new Date(Date.now() - 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isActive: true,
    });

    const result = await resolvePurchaseDiscount({
      userId: user._id,
      purchaseType: 'counseling',
      targetId: service._id,
      amount: 1000,
      couponCode: 'COUNSELONLY',
    });

    expect(result.error).toBeNull();
    expect(result.discountAmount).toBe(100);
    expect(result.finalAmount).toBe(900);

    const booking = await Booking.findOne({ user: user._id }).lean();
    expect(booking).toBeNull();
  });
});
