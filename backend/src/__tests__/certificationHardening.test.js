import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupDB } from './db.js';
import {
  createTestUser,
  createTestUser2,
  createTestCourse,
  createTestAdmin,
  createTestDeviceSession,
  generateUserToken,
  generateAdminToken,
  getAuthHeader,
} from './helpers.js';
import createTestApp from './app.js';
import { Enrollment } from '../models/enrollment.models.js';
import { CourseAssessment } from '../models/courseAssessment.models.js';
import { AssessmentAttempt } from '../models/assessmentAttempt.models.js';
import { VivaApplication } from '../models/vivaApplication.models.js';
import { Certificate } from '../models/certificate.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import { Transaction } from '../models/transaction.models.js';
import { isPaidMembershipForCertificate } from '../services/certificationEligibility.service.js';
import { issueMembershipCertificate } from '../services/certificate.service.js';

setupDB();

const app = createTestApp();

const oid = () => new mongoose.Types.ObjectId();

const createAssessment = (courseId, overrides = {}) => CourseAssessment.create({
  course: courseId,
  title: 'Certification Assessment',
  instructions: 'Answer all questions.',
  questions: [
    {
      prompt: 'What is 2 + 2?',
      type: 'mcq',
      options: [
        { key: 'A', text: '3' },
        { key: 'B', text: '4' },
      ],
      correctOptionKey: 'B',
      points: 1,
      order: 0,
    },
    {
      prompt: 'Which practice is included in the course?',
      type: 'mcq',
      options: [
        { key: 'A', text: 'Meditation' },
        { key: 'B', text: 'Skiing' },
      ],
      correctOptionKey: 'A',
      points: 1,
      order: 1,
    },
  ],
  passingRule: { type: 'correct_count', value: 1 },
  maxAttempts: 3,
  retakeCooldownHours: 0,
  timeLimitMinutes: 0,
  isEnabled: true,
  vivaRequired: true,
  ...overrides,
});

const completeEnrollment = (user, course, overrides = {}) => Enrollment.create({
  userId: user._id,
  courseId: course._id,
  completedVideos: (course.videos || []).map((video) => video._id),
  completedPdfs: (course.pdfs || []).map((pdf) => pdf._id),
  completedAudioLessons: (course.audioLessons || []).map((audio) => audio._id),
  completedReflections: [],
  ...overrides,
});

const userAuth = (user) => getAuthHeader(generateUserToken(user._id));
const adminAuth = (admin) => getAuthHeader(generateAdminToken(admin._id));

const correctAnswers = (assessment) =>
  Object.fromEntries(
    assessment.questions.map((question) => [String(question._id), question.correctOptionKey])
  );

const incorrectAnswers = (assessment) =>
  Object.fromEntries(
    assessment.questions.map((question) => [
      String(question._id),
      question.correctOptionKey === 'A' ? 'B' : 'A',
    ])
  );

const createMembership = (userId, overrides = {}) => UserMembership.create({
  userId,
  planId: oid(),
  planSnapshot: {
    title: 'Gold Membership',
    slug: 'gold',
    pricing: { amount: 1000, currency: 'INR', type: 'one_time' },
  },
  status: 'active',
  source: 'purchase',
  startDate: new Date(Date.now() - 86400000),
  endDate: new Date(Date.now() + 86400000 * 30),
  payment: {
    provider: 'razorpay',
    orderId: 'order_test_1',
    paymentId: 'pay_test_1',
    amount: 1000,
    currency: 'INR',
  },
  ...overrides,
});

describe('Certification hardening', () => {
  let user;
  let course;

  beforeEach(async () => {
    user = await createTestUser();
    course = await createTestCourse();
  });

  describe('assessment attempt constraints', () => {
    it('does not consume an attempt when the assessment is still locked', async () => {
      await createAssessment(course._id);
      await Enrollment.create({ userId: user._id, courseId: course._id });

      const blocked = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));

      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('ASSESSMENT_LOCKED');
      expect(await AssessmentAttempt.countDocuments({ user: user._id })).toBe(0);
    });

    it('enforces the maximum attempt count', async () => {
      const assessment = await createAssessment(course._id, { maxAttempts: 1 });
      await completeEnrollment(user, course);

      const started = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));
      expect(started.status).toBe(200);

      const submitted = await request(app)
        .post(`/api/courses/${course._id}/assessment/submit`)
        .set(userAuth(user))
        .send({
          attemptId: started.body.attempt._id,
          answers: incorrectAnswers(assessment),
        });
      expect(submitted.status).toBe(200);
      expect(submitted.body.result.passed).toBe(false);

      const overview = await request(app)
        .get(`/api/courses/${course._id}/assessment`)
        .set(userAuth(user));
      expect(overview.status).toBe(200);
      expect(overview.body.attempts.used).toBe(1);
      expect(overview.body.attempts.remaining).toBe(0);
      expect(overview.body.canStart).toBe(false);

      const blocked = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));
      expect(blocked.status).toBe(409);
      expect(blocked.body.code).toBe('MAX_ATTEMPTS_REACHED');
      expect(blocked.body.maxAttempts).toBe(1);
      expect(await AssessmentAttempt.countDocuments({ user: user._id })).toBe(1);
    });

    it('permanently completes the assessment after a passing attempt', async () => {
      const assessment = await createAssessment(course._id, {
        maxAttempts: 3,
        retakeCooldownHours: 0,
      });
      await completeEnrollment(user, course);

      const started = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));
      expect(started.status).toBe(200);

      const submitted = await request(app)
        .post(`/api/courses/${course._id}/assessment/submit`)
        .set(userAuth(user))
        .send({
          attemptId: started.body.attempt._id,
          answers: correctAnswers(assessment),
        });
      expect(submitted.status).toBe(200);
      expect(submitted.body.result.passed).toBe(true);

      const overview = await request(app)
        .get(`/api/courses/${course._id}/assessment`)
        .set(userAuth(user));
      expect(overview.status).toBe(200);
      expect(overview.body.attempts.completed).toBe(true);
      expect(overview.body.attempts.certificateIssued).toBe(false);
      expect(overview.body.attempts.remaining).toBe(0);
      expect(overview.body.canStart).toBe(false);

      const blocked = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));
      expect(blocked.status).toBe(409);
      expect(blocked.body.code).toBe('ASSESSMENT_COMPLETED');
      expect(await AssessmentAttempt.countDocuments({ user: user._id })).toBe(1);
    });

    it('enforces the retake cooldown and allows retake after it elapses', async () => {
      const assessment = await createAssessment(course._id, {
        maxAttempts: 3,
        retakeCooldownHours: 1,
      });
      await completeEnrollment(user, course);

      const first = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));
      expect(first.status).toBe(200);

      await request(app)
        .post(`/api/courses/${course._id}/assessment/submit`)
        .set(userAuth(user))
        .send({
          attemptId: first.body.attempt._id,
          answers: incorrectAnswers(assessment),
        });

      const blocked = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe('RETAKE_COOLDOWN');
      expect(blocked.body.nextAvailableAt).toBeTruthy();

      await AssessmentAttempt.updateOne(
        { _id: first.body.attempt._id },
        { $set: { submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } }
      );

      const second = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));
      expect(second.status).toBe(200);
      expect(second.body.resumed).toBe(false);
      expect(second.body.attempt.attemptNumber).toBe(2);
      expect(await AssessmentAttempt.countDocuments({ user: user._id })).toBe(2);
    });

    it('expires a timed attempt and consumes it without resuming it', async () => {
      const assessment = await createAssessment(course._id, {
        maxAttempts: 2,
        timeLimitMinutes: 1,
      });
      await completeEnrollment(user, course);

      const started = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));
      expect(started.status).toBe(200);
      expect(started.body.attempt.expiresAt).toBeTruthy();

      await AssessmentAttempt.updateOne(
        { _id: started.body.attempt._id },
        { $set: { expiresAt: new Date(Date.now() - 60 * 1000) } }
      );

      const late = await request(app)
        .post(`/api/courses/${course._id}/assessment/submit`)
        .set(userAuth(user))
        .send({
          attemptId: started.body.attempt._id,
          answers: correctAnswers(assessment),
        });
      expect(late.status).toBe(409);
      expect(late.body.code).toBe('ATTEMPT_EXPIRED');

      const expired = await AssessmentAttempt.findById(started.body.attempt._id).lean();
      expect(expired.status).toBe('expired');

      const overview = await request(app)
        .get(`/api/courses/${course._id}/assessment`)
        .set(userAuth(user));
      expect(overview.status).toBe(200);
      expect(overview.body.attempts.used).toBe(1);
      expect(overview.body.attempts.remaining).toBe(1);
      expect(overview.body.canStart).toBe(true);

      const retried = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));
      expect(retried.status).toBe(200);
      expect(retried.body.resumed).toBe(false);
      expect(retried.body.attempt.attemptNumber).toBe(2);
    });
  });

  describe('assessment attempt isolation', () => {
    it('rejects another user or another course submitting an attempt', async () => {
      const assessment = await createAssessment(course._id);
      await completeEnrollment(user, course);

      const started = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));
      expect(started.status).toBe(200);

      const otherUser = await createTestUser2();
      await createTestDeviceSession(otherUser._id);

      const otherUserSubmit = await request(app)
        .post(`/api/courses/${course._id}/assessment/submit`)
        .set(userAuth(otherUser))
        .send({
          attemptId: started.body.attempt._id,
          answers: correctAnswers(assessment),
        });
      expect(otherUserSubmit.status).toBe(404);

      const otherCourse = await createTestCourse({
        slug: `other-course-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      });
      const otherCourseSubmit = await request(app)
        .post(`/api/courses/${otherCourse._id}/assessment/submit`)
        .set(userAuth(user))
        .send({
          attemptId: started.body.attempt._id,
          answers: correctAnswers(assessment),
        });
      expect(otherCourseSubmit.status).toBe(404);

      const untouched = await AssessmentAttempt.findById(started.body.attempt._id).lean();
      expect(untouched.status).toBe('in_progress');
      expect(untouched.answers).toHaveLength(0);
    });

    it('resumes one attempt when two starts race', async () => {
      await createAssessment(course._id);
      await completeEnrollment(user, course);

      const responses = await Promise.all([
        request(app)
          .post(`/api/courses/${course._id}/assessment/start`)
          .set(userAuth(user)),
        request(app)
          .post(`/api/courses/${course._id}/assessment/start`)
          .set(userAuth(user)),
      ]);

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(responses.filter((response) => response.body.resumed === false)).toHaveLength(1);
      expect(responses.filter((response) => response.body.resumed === true)).toHaveLength(1);
      expect(await AssessmentAttempt.countDocuments({ user: user._id })).toBe(1);
    });
  });

  describe('viva transition guardrails', () => {
    it('rejects skipping states and missing required scheduling/result fields', async () => {
      const admin = await createTestAdmin({
        permissions: ['manage_courses', 'manage_users'],
      });
      const viva = await VivaApplication.create({
        user: user._id,
        course: course._id,
        assessmentAttempt: oid(),
        status: 'applied',
        appliedAt: new Date(),
        statusHistory: [{
          from: null,
          to: 'applied',
          actorType: 'user',
          actor: user._id,
          at: new Date(),
        }],
      });

      const earlyPass = await request(app)
        .patch(`/api/admin/viva-applications/${viva._id}/status`)
        .set(adminAuth(admin))
        .send({ status: 'passed', remarks: 'Skipped too far' });
      expect(earlyPass.status).toBe(409);

      const earlyCertificate = await request(app)
        .post('/api/admin/certificates/assessment')
        .set(adminAuth(admin))
        .send({
          userId: String(user._id),
          courseId: String(course._id),
          vivaApplicationId: String(viva._id),
        });
      expect(earlyCertificate.status).toBe(400);

      const underReview = await request(app)
        .patch(`/api/admin/viva-applications/${viva._id}/status`)
        .set(adminAuth(admin))
        .send({ status: 'under_review' });
      expect(underReview.status).toBe(200);

      const unscheduled = await request(app)
        .patch(`/api/admin/viva-applications/${viva._id}/status`)
        .set(adminAuth(admin))
        .send({ status: 'scheduled' });
      expect(unscheduled.status).toBe(400);

      const scheduled = await request(app)
        .patch(`/api/admin/viva-applications/${viva._id}/status`)
        .set(adminAuth(admin))
        .send({
          status: 'scheduled',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          meetingLink: 'https://meet.example.com/viva',
        });
      expect(scheduled.status).toBe(200);

      const passBeforeCompletion = await request(app)
        .patch(`/api/admin/viva-applications/${viva._id}/status`)
        .set(adminAuth(admin))
        .send({ status: 'passed', remarks: 'Skipped completion' });
      expect(passBeforeCompletion.status).toBe(409);

      const completed = await request(app)
        .patch(`/api/admin/viva-applications/${viva._id}/status`)
        .set(adminAuth(admin))
        .send({ status: 'completed' });
      expect(completed.status).toBe(200);

      const missingRemarks = await request(app)
        .patch(`/api/admin/viva-applications/${viva._id}/status`)
        .set(adminAuth(admin))
        .send({ status: 'passed' });
      expect(missingRemarks.status).toBe(400);

      const passed = await request(app)
        .patch(`/api/admin/viva-applications/${viva._id}/status`)
        .set(adminAuth(admin))
        .send({ status: 'passed', remarks: 'Passed after review' });
      expect(passed.status).toBe(200);

      const afterPass = await request(app)
        .patch(`/api/admin/viva-applications/${viva._id}/status`)
        .set(adminAuth(admin))
        .send({ status: 'cancelled' });
      expect(afterPass.status).toBe(409);

      const refreshed = await VivaApplication.findById(viva._id).lean();
      expect(refreshed.status).toBe('passed');
      expect(refreshed.statusHistory.map((entry) => entry.to)).toEqual([
        'applied',
        'under_review',
        'scheduled',
        'completed',
        'passed',
      ]);
    });
  });

  describe('certificate revocation and user scoping', () => {
    it('blocks verification and viewing after revocation and scopes certificates to their owner', async () => {
      const otherUser = await createTestUser2();
      await createTestDeviceSession(otherUser._id);

      const certificate = await Certificate.create({
        certificateId: 'PS-CERT-REVOKE-0001',
        type: 'course_participation',
        title: 'Certificate of Participation',
        user: user._id,
        course: course._id,
        issuedTo: user.displayName,
        courseName: course.title,
        isRevoked: false,
        status: 'issued',
      });

      const beforeVerify = await request(app)
        .get(`/api/certificates/verify/${certificate.certificateId}`);
      expect(beforeVerify.status).toBe(200);
      expect(beforeVerify.body.valid).toBe(true);

      const beforeView = await request(app)
        .get(`/api/certificates/${certificate.certificateId}/view`);
      expect(beforeView.status).toBe(200);
      expect(beforeView.text).toContain(user.displayName);

      const ownerList = await request(app)
        .get('/api/user/profile/certificates')
        .set(userAuth(user));
      expect(ownerList.status).toBe(200);
      expect(ownerList.body.certificates).toHaveLength(1);

      const otherList = await request(app)
        .get('/api/user/profile/certificates')
        .set(userAuth(otherUser));
      expect(otherList.status).toBe(200);
      expect(otherList.body.certificates).toHaveLength(0);

      const admin = await createTestAdmin({ permissions: ['manage_users'] });
      const revoked = await request(app)
        .post(`/api/admin/certificates/${certificate.certificateId}/revoke`)
        .set(adminAuth(admin))
        .send({ reason: 'Issued in error' });

      expect(revoked.status).toBe(200);
      expect(revoked.body.certificate.status).toBe('revoked');
      expect(revoked.body.certificate.isRevoked).toBe(true);
      expect(revoked.body.certificate.auditTrail.at(-1).action).toBe('revoked');
      expect(revoked.body.certificate.auditTrail.at(-1).reason).toBe('Issued in error');

      const afterVerify = await request(app)
        .get(`/api/certificates/verify/${certificate.certificateId}`);
      expect(afterVerify.status).toBe(404);
      expect(afterVerify.body.valid).toBe(false);

      const afterView = await request(app)
        .get(`/api/certificates/${certificate.certificateId}/view`);
      expect(afterView.status).toBe(404);

      const ownerListAfter = await request(app)
        .get('/api/user/profile/certificates')
        .set(userAuth(user));
      expect(ownerListAfter.status).toBe(200);
      expect(ownerListAfter.body.certificates).toHaveLength(0);
    });
  });

  describe('certification admin permissions', () => {
    it('requires manage_users for certificates and manage_courses for assessments and viva', async () => {
      const usersAdmin = await createTestAdmin({
        email: 'users-only@example.com',
        permissions: ['manage_users'],
      });
      const coursesAdmin = await createTestAdmin({
        email: 'courses-only@example.com',
        permissions: ['manage_courses'],
      });

      const certificatesAllowed = await request(app)
        .get('/api/admin/certificates')
        .set(adminAuth(usersAdmin));
      expect(certificatesAllowed.status).toBe(200);

      const vivaDenied = await request(app)
        .get('/api/admin/viva-applications')
        .set(adminAuth(usersAdmin));
      expect(vivaDenied.status).toBe(403);

      const issueDenied = await request(app)
        .post('/api/admin/certificates/assessment')
        .set(adminAuth(usersAdmin))
        .send({});
      expect(issueDenied.status).toBe(400);

      const vivaAllowed = await request(app)
        .get('/api/admin/viva-applications')
        .set(adminAuth(coursesAdmin));
      expect(vivaAllowed.status).toBe(200);

      const certificatesDenied = await request(app)
        .get('/api/admin/certificates')
        .set(adminAuth(coursesAdmin));
      expect(certificatesDenied.status).toBe(403);

      const issueDeniedForCourses = await request(app)
        .post('/api/admin/certificates/assessment')
        .set(adminAuth(coursesAdmin))
        .send({});
      expect(issueDeniedForCourses.status).toBe(403);
    });
  });

  describe('membership certificate eligibility', () => {
    it('rejects non-purchase sources and missing proof but accepts a linked successful transaction', async () => {
      const adminGrant = await createMembership(user._id, {
        source: 'admin_grant',
        payment: {
          provider: 'razorpay',
          orderId: 'order_admin_grant',
          paymentId: 'pay_admin_grant',
          amount: 1000,
          currency: 'INR',
        },
      });
      expect(await isPaidMembershipForCertificate(adminGrant, user._id)).toBe(false);
      const adminGrantIssue = await issueMembershipCertificate(user._id, adminGrant._id);
      expect(adminGrantIssue.issued).toBe(false);
      expect(adminGrantIssue.certificate).toBeNull();

      const migration = await createMembership(user._id, {
        source: 'migration',
        payment: {
          provider: 'razorpay',
          orderId: 'order_migration',
          paymentId: 'pay_migration',
          amount: 1000,
          currency: 'INR',
        },
      });
      expect(await isPaidMembershipForCertificate(migration, user._id)).toBe(false);

      const missingProof = await createMembership(user._id, {
        source: 'purchase',
        payment: { provider: 'manual', amount: 0, currency: 'INR' },
      });
      expect(await isPaidMembershipForCertificate(missingProof, user._id)).toBe(false);

      const linked = await createMembership(user._id, {
        source: 'purchase',
        payment: { provider: 'manual', amount: 0, currency: 'INR' },
        metadata: { orderId: 'order_linked_tx', paymentId: 'pay_linked_tx' },
      });
      await Transaction.create({
        userId: user._id,
        source: 'membership',
        sourceId: 'membership_linked_tx',
        amount: 1000,
        status: 'success',
        provider: 'razorpay',
        providerRef: 'pay_linked_tx',
        metadata: { paymentId: 'pay_linked_tx', orderId: 'order_linked_tx' },
      });

      expect(await isPaidMembershipForCertificate(linked, user._id)).toBe(true);
      const linkedIssue = await issueMembershipCertificate(user._id, linked._id);
      expect(linkedIssue.issued).toBe(true);
      expect(linkedIssue.certificate.type).toBe('membership');
    });
  });
});
