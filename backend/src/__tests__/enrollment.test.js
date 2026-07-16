import request from 'supertest';
import createTestApp from './app.js';
import { Course } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import {
  createTestUser,
  createTestCourse,
  generateUserToken,
  getAuthHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

describe('Enrollment Module - /api/enrollments', () => {
  let user;
  let token;
  let course;

  beforeEach(async () => {
    user = await createTestUser({ assessmentCompleted: true });
    token = generateUserToken(user._id);
    
    // Create an assessment record to pass the assessmentRequired middleware
    const Assessment = (await import('../models/assessment.models.js')).default;
    await Assessment.create({
      user: user._id,
      age: 25,
      occupation: 'Developer',
      location: 'Delhi',
      physicalIssue: false,
      specialDiseaseIssue: false,
      relationshipIssue: false,
      financialIssue: false,
      mentalHealthIssue: false,
      spiritualGrowth: false
    });

    course = await createTestCourse();
  });

  describe('POST /api/enrollments/enroll', () => {
    it('should enroll user in a course', async () => {
      const res = await request(app)
        .post('/api/enrollments/enroll')
        .set(getAuthHeader(token))
        .send({ courseId: course._id.toString() });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.enrollment).toBeDefined();
      expect(res.body.enrollment.courseId).toBe(course._id.toString());
    });

    it('should reject enrollment without authentication', async () => {
      const res = await request(app)
        .post('/api/enrollments/enroll')
        .send({ courseId: course._id.toString() });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject duplicate enrollment', async () => {
      await request(app)
        .post('/api/enrollments/enroll')
        .set(getAuthHeader(token))
        .send({ courseId: course._id.toString() });

      const res = await request(app)
        .post('/api/enrollments/enroll')
        .set(getAuthHeader(token))
        .send({ courseId: course._id.toString() });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/enrollments/my-courses', () => {
    it('should return user enrollments', async () => {
      await Enrollment.create({
        userId: user._id,
        courseId: course._id,
      });

      const res = await request(app)
        .get('/api/enrollments/my-courses')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.enrollments.length).toBe(1);
    });

    it('should return empty list for new user', async () => {
      const res = await request(app)
        .get('/api/enrollments/my-courses')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.enrollments.length).toBe(0);
    });
  });

  describe('GET /api/enrollments/continue-learning', () => {
    it('should return continue learning data', async () => {
      await Enrollment.create({
        userId: user._id,
        courseId: course._id,
        lastAccessedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/enrollments/continue-learning')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/enrollments/check/:courseId', () => {
    it('should return false for non-enrolled courses', async () => {
      const res = await request(app)
        .get(`/api/enrollments/check/${course._id}`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isEnrolled).toBe(false);
    });

    it('should return true for enrolled courses', async () => {
      await Enrollment.create({
        userId: user._id,
        courseId: course._id,
      });

      const res = await request(app)
        .get(`/api/enrollments/check/${course._id}`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isEnrolled).toBe(true);
    });
  });

  describe('GET /api/enrollments/course/:courseId/progress', () => {
    it('should return course progress', async () => {
      await Enrollment.create({
        userId: user._id,
        courseId: course._id,
        progress: 50,
        completedVideos: [course.videos[0]._id],
      });

      const res = await request(app)
        .get(`/api/enrollments/course/${course._id}/progress`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not enrolled', async () => {
      const res = await request(app)
        .get(`/api/enrollments/course/${course._id}/progress`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/enrollments/course/:courseId/video/:videoId/complete', () => {
    it('should mark video complete', async () => {
      const enrollment = await Enrollment.create({
        userId: user._id,
        courseId: course._id,
      });
      const videoId = course.videos[0]._id;

      const res = await request(app)
        .post(`/api/enrollments/course/${course._id}/video/${videoId}/complete`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/enrollments/course/:courseId', () => {
    it('should unenroll from a course', async () => {
      await Enrollment.create({
        userId: user._id,
        courseId: course._id,
      });

      const res = await request(app)
        .delete(`/api/enrollments/course/${course._id}`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const count = await Enrollment.countDocuments({
        userId: user._id,
        courseId: course._id,
      });
      expect(count).toBe(0);
    });
  });
});
