import request from 'supertest';
import createTestApp from './app.js';
import Assessment from '../models/assessment.models.js';
import { Certificate } from '../models/certificate.models.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import { upsertActiveUserMembership } from '../services/userMembership.service.js';
import {
  createTestUser,
  createTestCourse,
  generateUserToken,
  getAuthHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

const createPlan = (overrides = {}) => MembershipPlan.create({
  title: 'Silver',
  slug: 'silver',
  status: 'published',
  pricing: { oneTime: { amount: 500, currency: 'INR' } },
  validityDays: 365,
  ...overrides,
});

const createMembership = (userId, planId, overrides = {}) => UserMembership.create({
  userId,
  planId,
  planSnapshot: {
    title: 'Silver',
    slug: 'silver',
    pricing: { amount: 500, currency: 'INR', type: 'one_time' },
  },
  status: 'active',
  source: 'purchase',
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  payment: {
    provider: 'razorpay',
    orderId: 'order_access_test',
    paymentId: 'pay_access_test',
    amount: 500,
    currency: 'INR',
  },
  ...overrides,
});

const completeAssessment = (userId) => Assessment.create({
  user: userId,
  age: 25,
  occupation: 'Developer',
  location: 'Delhi',
  physicalIssue: false,
  specialDiseaseIssue: false,
  relationshipIssue: false,
  financialIssue: false,
  mentalHealthIssue: false,
  spiritualGrowth: false,
});

describe('Membership course access', () => {
  let user;
  let token;
  let restrictedCourse;

  const catalogCourse = (res, courseId) => res.body.courses.find(
    (course) => String(course._id) === String(courseId)
  );

  beforeEach(async () => {
    user = await createTestUser({ assessmentCompleted: true });
    token = generateUserToken(user._id);
    await completeAssessment(user._id);
    restrictedCourse = await createTestCourse({
      title: 'Silver Only Course',
      includedInPlans: ['silver'],
    });
  });

  it('blocks a free user from enrolling in a plan-only course', async () => {
    const catalogRes = await request(app)
      .get('/api/enrollments/catalog')
      .set(getAuthHeader(token));

    expect(catalogRes.status).toBe(200);
    const course = catalogCourse(catalogRes, restrictedCourse._id);
    expect(course.access).toMatchObject({
      canEnroll: false,
      canAccess: false,
      reason: 'plan_required',
    });

    const enrollRes = await request(app)
      .post('/api/enrollments/enroll')
      .set(getAuthHeader(token))
      .send({ courseId: String(restrictedCourse._id) });

    expect(enrollRes.status).toBe(403);
    expect(enrollRes.body.reason).toBe('plan_required');
    expect(enrollRes.body.upgradeRequired).toBe(true);
  });

  it('allows an active paid membership to access and enroll in its included course', async () => {
    const plan = await createPlan();
    await createMembership(user._id, plan._id);

    const catalogRes = await request(app)
      .get('/api/enrollments/catalog')
      .set(getAuthHeader(token));

    expect(catalogRes.status).toBe(200);
    const course = catalogCourse(catalogRes, restrictedCourse._id);
    expect(course.access).toMatchObject({
      canEnroll: true,
      canAccess: true,
      reason: 'allowed',
    });

    const enrollRes = await request(app)
      .post('/api/enrollments/enroll')
      .set(getAuthHeader(token))
      .send({ courseId: String(restrictedCourse._id) });

    expect(enrollRes.status).toBe(201);
    expect(enrollRes.body.enrollment.courseId).toBe(String(restrictedCourse._id));
  });

  it('does not grant new access when the membership has expired', async () => {
    const plan = await createPlan();
    await createMembership(user._id, plan._id, {
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const catalogRes = await request(app)
      .get('/api/enrollments/catalog')
      .set(getAuthHeader(token));

    expect(catalogRes.status).toBe(200);
    const course = catalogCourse(catalogRes, restrictedCourse._id);
    expect(course.access).toMatchObject({
      canEnroll: false,
      canAccess: false,
      reason: 'plan_required',
    });

    const enrollRes = await request(app)
      .post('/api/enrollments/enroll')
      .set(getAuthHeader(token))
      .send({ courseId: String(restrictedCourse._id) });

    expect(enrollRes.status).toBe(403);
    expect(enrollRes.body.reason).toBe('plan_required');
  });

  it('does not grant new access when the membership is cancelled', async () => {
    const plan = await createPlan();
    await createMembership(user._id, plan._id, { status: 'cancelled' });

    const enrollRes = await request(app)
      .post('/api/enrollments/enroll')
      .set(getAuthHeader(token))
      .send({ courseId: String(restrictedCourse._id) });

    expect(enrollRes.status).toBe(403);
    expect(enrollRes.body.reason).toBe('plan_required');
  });

  it('revokes media and catalog access for an enrolled course after membership expiry', async () => {
    const plan = await createPlan();
    const membership = await createMembership(user._id, plan._id);

    const enrollRes = await request(app)
      .post('/api/enrollments/enroll')
      .set(getAuthHeader(token))
      .send({ courseId: String(restrictedCourse._id) });
    expect(enrollRes.status).toBe(201);

    const videosBefore = await request(app)
      .get(`/api/courses/${restrictedCourse._id}/videos`)
      .set(getAuthHeader(token));
    expect(videosBefore.status).toBe(200);

    const pdfsBefore = await request(app)
      .get(`/api/courses/${restrictedCourse._id}/pdfs`)
      .set(getAuthHeader(token));
    expect(pdfsBefore.status).toBe(200);

    await UserMembership.updateOne(
      { _id: membership._id },
      { $set: { endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    );

    const catalogRes = await request(app)
      .get('/api/enrollments/catalog')
      .set(getAuthHeader(token));
    expect(catalogRes.status).toBe(200);
    expect(catalogCourse(catalogRes, restrictedCourse._id).access).toMatchObject({
      canEnroll: false,
      canAccess: false,
      reason: 'plan_required',
    });

    const videosAfter = await request(app)
      .get(`/api/courses/${restrictedCourse._id}/videos`)
      .set(getAuthHeader(token));
    expect(videosAfter.status).toBe(403);
    expect(videosAfter.body.reason).toBe('plan_required');

    const pdfsAfter = await request(app)
      .get(`/api/courses/${restrictedCourse._id}/pdfs`)
      .set(getAuthHeader(token));
    expect(pdfsAfter.status).toBe(403);
    expect(pdfsAfter.body.reason).toBe('plan_required');
  });

  it('keeps free course content accessible without a paid membership', async () => {
    const freeCourse = await createTestCourse({ title: 'Free Course' });

    const videosRes = await request(app)
      .get(`/api/courses/${freeCourse._id}/videos`)
      .set(getAuthHeader(token));

    expect(videosRes.status).toBe(200);
    expect(videosRes.body.videos).toHaveLength(2);

    const pdfsRes = await request(app)
      .get(`/api/courses/${freeCourse._id}/pdfs`)
      .set(getAuthHeader(token));

    expect(pdfsRes.status).toBe(200);
    expect(pdfsRes.body.pdfs).toHaveLength(1);
  });

  it('issues a separate membership certificate for a renewed period', async () => {
    const plan = await createPlan();
    const firstStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const firstEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const secondStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const secondEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const firstMembership = await upsertActiveUserMembership({
      userId: user._id,
      planSlug: 'silver',
      startDate: firstStart,
      endDate: firstEnd,
      source: 'purchase',
      payment: {
        provider: 'razorpay',
        orderId: 'order_period_1',
        paymentId: 'pay_period_1',
        amount: 500,
        currency: 'INR',
      },
    });

    expect(await Certificate.countDocuments({ membership: firstMembership._id })).toBe(1);

    const renewedMembership = await upsertActiveUserMembership({
      userId: user._id,
      planSlug: 'silver',
      startDate: secondStart,
      endDate: secondEnd,
      source: 'renewal',
      payment: {
        provider: 'razorpay',
        orderId: 'order_period_2',
        paymentId: 'pay_period_2',
        amount: 500,
        currency: 'INR',
      },
    });

    expect(String(renewedMembership._id)).toBe(String(firstMembership._id));

    const certificates = await Certificate.find({
      membership: renewedMembership._id,
      type: 'membership',
    }).sort({ validFrom: 1 }).lean();

    expect(certificates).toHaveLength(2);
    expect(certificates[0].validFrom.toISOString()).toBe(firstStart.toISOString());
    expect(certificates[0].validTo.toISOString()).toBe(firstEnd.toISOString());
    expect(certificates[1].validFrom.toISOString()).toBe(secondStart.toISOString());
    expect(certificates[1].validTo.toISOString()).toBe(secondEnd.toISOString());
    expect(certificates[0].certificateId).not.toBe(certificates[1].certificateId);
  });
});
