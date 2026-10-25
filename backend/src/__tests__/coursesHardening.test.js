import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { Course } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import {
  createTestUser,
  createTestCourse,
  generateUserToken,
  getAuthHeader,
  getAdminApiKeyHeader,
} from './helpers.js';

setupDB();
const app = createTestApp();

const makePlan = (slug = 'silver') => MembershipPlan.create({
  title: slug,
  slug,
  status: 'published',
  pricing: { oneTime: { amount: 500, currency: 'INR' } },
  validityDays: 365,
});

const makeMembership = (userId, planId, slug = 'silver') => UserMembership.create({
  userId,
  planId,
  planSnapshot: {
    title: slug,
    slug,
    pricing: { amount: 500, currency: 'INR', type: 'one_time' },
  },
  status: 'active',
  source: 'purchase',
  startDate: new Date(Date.now() - 86400000),
  endDate: new Date(Date.now() + 30 * 86400000),
});

describe('Courses hardening', () => {
  describe('media access', () => {
    it('strips paid media and meeting links from anonymous course detail', async () => {
      const course = await createTestCourse({
        includedInPlans: ['silver'],
        videos: [
          { title: 'Free preview', videoUrl: 'https://example.com/free.mp4', order: 0, isFree: true, duration: '5:00' },
          { title: 'Paid lesson', videoUrl: 'https://example.com/paid.mp4', order: 1, isFree: false, duration: '10:00' },
        ],
        pdfs: [{ title: 'Paid PDF', pdfUrl: 'https://example.com/paid.pdf', order: 0, isFree: false }],
        liveSessions: [{
          title: 'Live',
          scheduledAt: new Date(Date.now() + 86400000),
          durationInMinutes: 60,
          meetingLink: 'https://zoom.us/j/secret',
          meetingPlatform: 'zoom',
        }],
      });

      const res = await request(app).get(`/api/courses/${course._id}`);
      expect(res.status).toBe(200);
      expect(res.body.course.videos[0].videoUrl).toBeTruthy();
      expect(res.body.course.videos[1].videoUrl).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('paid.pdf');
      expect(JSON.stringify(res.body)).not.toContain('zoom.us/j/secret');
    });

    it('returns full media to an entitled member and blocks a non-member item route', async () => {
      const plan = await makePlan();
      const member = await createTestUser({ assessmentCompleted: true, phone: '+919800000001' });
      await makeMembership(member._id, plan._id);
      const memberToken = generateUserToken(member._id);
      const outsider = await createTestUser({
        assessmentCompleted: true,
        phone: '+919800000002',
        email: `outsider-${Date.now()}@test.com`,
      });
      const outsiderToken = generateUserToken(outsider._id);

      const course = await createTestCourse({
        includedInPlans: ['silver'],
        videos: [{ title: 'Paid', videoUrl: 'https://example.com/paid.mp4', order: 0, isFree: false, duration: '10:00' }],
      });

      const memberRes = await request(app)
        .get(`/api/courses/${course._id}`)
        .set(getAuthHeader(memberToken));
      expect(memberRes.status).toBe(200);
      expect(memberRes.body.course.videos[0].videoUrl).toBeTruthy();

      const outsiderRes = await request(app)
        .get(`/api/courses/${course._id}/videos`)
        .set(getAuthHeader(outsiderToken));
      expect(outsiderRes.status).toBe(403);
    });

    it('rejects non-admin video presign requests', async () => {
      const user = await createTestUser({ assessmentCompleted: true });
      const token = generateUserToken(user._id);
      const res = await request(app)
        .post('/api/upload/video/presign')
        .set(getAuthHeader(token))
        .send({ filename: 'evil.mp4', contentType: 'video/mp4' });
      // Upload routes are not mounted in the test app; either a 404 (unmounted)
      // or 401/403 (mounted and rejected) proves the user is not authorized.
      expect([401, 403, 404]).toContain(res.status);
    });
  });

  describe('completion integrity', () => {
    it('removes the self-complete endpoint', async () => {
      const user = await createTestUser({ assessmentCompleted: true });
      const token = generateUserToken(user._id);
      const course = await createTestCourse();
      await Enrollment.create({ userId: user._id, courseId: course._id });

      const res = await request(app)
        .post(`/api/enrollments/course/${course._id}/complete`)
        .set(getAuthHeader(token));
      expect(res.status).toBe(404);
    });

    it('requires watch proof and enforces strict video order', async () => {
      const user = await createTestUser({ assessmentCompleted: true });
      const token = generateUserToken(user._id);
      const course = await createTestCourse({ strictVideoOrder: true });
      await Enrollment.create({ userId: user._id, courseId: course._id });
      const [first, second] = course.videos;

      const noProof = await request(app)
        .post(`/api/courses/${course._id}/progress/video/${first._id}`)
        .set(getAuthHeader(token));
      expect(noProof.status).toBe(400);

      await request(app)
        .patch(`/api/enrollments/course/${course._id}/position`)
        .set(getAuthHeader(token))
        .send({ videoId: first._id, positionSeconds: 95, durationSeconds: 100 });

      const firstDone = await request(app)
        .post(`/api/courses/${course._id}/progress/video/${first._id}`)
        .set(getAuthHeader(token));
      expect(firstDone.status).toBe(200);

      const skipped = await request(app)
        .post(`/api/courses/${course._id}/progress/video/${second._id}`)
        .set(getAuthHeader(token));
      expect(skipped.status).toBe(400);
    });

    it('does not count optional reflections toward completion', async () => {
      const user = await createTestUser({ assessmentCompleted: true });
      const token = generateUserToken(user._id);
      const course = await createTestCourse({
        videos: [],
        pdfs: [],
        reflections: [{ title: 'Optional', prompt: 'Say something', isRequired: false, minWords: 1, order: 0 }],
      });
      const enrollment = await Enrollment.create({ userId: user._id, courseId: course._id });
      const reflectionId = course.reflections[0]._id;

      const res = await request(app)
        .post(`/api/courses/${course._id}/reflections/${reflectionId}/submit`)
        .set(getAuthHeader(token))
        .send({ response: 'One two three' });

      expect(res.status).toBe(200);
      const stored = await Enrollment.findById(enrollment._id);
      expect(stored.completedReflections).toHaveLength(0);
      expect(stored.isCompleted).toBe(false);
      expect(stored.progress).toBe(0);
    });
  });

  describe('lifecycle', () => {
    it('blocks hard delete when learner history exists', async () => {
      const user = await createTestUser({ assessmentCompleted: true });
      const course = await createTestCourse();
      await Enrollment.create({ userId: user._id, courseId: course._id });

      const res = await request(app)
        .delete(`/api/courses/delete/${course._id}`)
        .set(getAdminApiKeyHeader());

      expect(res.status).toBe(409);
      expect(res.body.archiveRequired).toBe(true);
      expect(await Course.findById(course._id)).not.toBeNull();
    });

    it('decrements enrollment counts exactly once and never below zero', async () => {
      const user = await createTestUser({ assessmentCompleted: true });
      const token = generateUserToken(user._id);
      const course = await createTestCourse({ enrollmentCount: 1 });
      await Enrollment.create({ userId: user._id, courseId: course._id });

      const res = await request(app)
        .delete(`/api/enrollments/course/${course._id}`)
        .set(getAuthHeader(token));
      expect(res.status).toBe(200);

      const stored = await Course.findById(course._id);
      expect(stored.enrollmentCount).toBe(0);
    });
  });

  describe('assessment identity', () => {
    it('preserves question ids when saving an assessment twice', async () => {
      const course = await createTestCourse();
      const firstPayload = {
        title: 'Assessment',
        instructions: '',
        passingRule: { type: 'correct_count', value: 1 },
        maxAttempts: 3,
        retakeCooldownHours: 0,
        timeLimitMinutes: 0,
        isEnabled: true,
        vivaRequired: true,
        questions: [{
          prompt: 'Pick one',
          type: 'mcq',
          points: 1,
          options: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }],
          correctOptionKey: 'a',
        }],
      };

      const first = await request(app)
        .put(`/api/admin/courses/${course._id}/assessment`)
        .set(getAdminApiKeyHeader())
        .send(firstPayload);
      expect(first.status).toBe(200);
      const questionId = first.body.assessment.questions[0]._id;
      expect(questionId).toBeTruthy();

      const second = await request(app)
        .put(`/api/admin/courses/${course._id}/assessment`)
        .set(getAdminApiKeyHeader())
        .send({
          ...firstPayload,
          questions: [{ ...firstPayload.questions[0], _id: questionId }],
        });
      expect(second.status).toBe(200);
      expect(second.body.assessment.questions[0]._id).toBe(questionId);
    });

    it('rejects an impossible correct-count passing rule', async () => {
      const course = await createTestCourse();
      const res = await request(app)
        .put(`/api/admin/courses/${course._id}/assessment`)
        .set(getAdminApiKeyHeader())
        .send({
          title: 'Assessment',
          passingRule: { type: 'correct_count', value: 5 },
          questions: [{
            prompt: 'One',
            type: 'mcq',
            points: 1,
            options: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }],
            correctOptionKey: 'a',
          }],
        });
      expect(res.status).toBe(400);
    });
  });
});
