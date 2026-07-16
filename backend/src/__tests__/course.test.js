import request from 'supertest';
import createTestApp from './app.js';
import { Course } from '../models/course.models.js';
import {
  createTestCourse,
  getAdminApiKeyHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

describe('Course Module - /api/courses', () => {
  describe('GET /api/courses/all', () => {
    it('should return a list of courses', async () => {
      await createTestCourse({ slug: 'course-one' });
      await createTestCourse({ slug: 'course-two' });

      const res = await request(app).get('/api/courses/all');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.courses).toBeDefined();
      expect(res.body.courses.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no courses exist', async () => {
      const res = await request(app).get('/api/courses/all');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.courses).toEqual([]);
    });

    it('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestCourse({ slug: `paginated-course-${i}` });
      }

      const res = await request(app)
        .get('/api/courses/all')
        .query({ page: 1, limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.courses.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/courses/:id', () => {
    it('should return course by ID', async () => {
      const course = await createTestCourse();

      const res = await request(app).get(`/api/courses/${course._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.course.title).toBe('Test Course');
    });

    it('should return 404 for non-existent course', async () => {
      const res = await request(app).get('/api/courses/5f7b3a2b9d3e2a1b2c3d4e5f');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/courses/slug/:slug', () => {
    it('should return course by slug', async () => {
      await createTestCourse({ slug: 'my-unique-slug' });

      const res = await request(app).get('/api/courses/slug/my-unique-slug');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.course.slug).toBe('my-unique-slug');
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app).get('/api/courses/slug/non-existent-slug');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/courses/create', () => {
    it('should create course with admin auth', async () => {
      const res = await request(app)
        .post('/api/courses/create')
        .set(getAdminApiKeyHeader())
        .send({
          title: 'New Test Course',
          description: 'A newly created course for testing',
          category: 'meditation',
          duration: '6 weeks',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.course.title).toBe('New Test Course');
      expect(res.body.course.slug).toBe('new-test-course');

      const course = await Course.findById(res.body.course._id);
      expect(course).toBeTruthy();
    });

    it('should reject without admin auth', async () => {
      const res = await request(app)
        .post('/api/courses/create')
        .send({
          title: 'Unauthorized Course',
          description: 'Should fail without auth',
          category: 'yoga',
          duration: '3 weeks',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject with invalid data', async () => {
      const res = await request(app)
        .post('/api/courses/create')
        .set(getAdminApiKeyHeader())
        .send({
          title: 'No',
          description: 'Short',
          category: '',
          duration: '3 weeks',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/courses/update/:id', () => {
    it('should update course with admin auth', async () => {
      const course = await createTestCourse();

      const res = await request(app)
        .put(`/api/courses/update/${course._id}`)
        .set(getAdminApiKeyHeader())
        .send({ title: 'Updated Course Title' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.course.title).toBe('Updated Course Title');
    });
  });

  describe('DELETE /api/courses/delete/:id', () => {
    it('should delete course with admin auth', async () => {
      const course = await createTestCourse();

      const res = await request(app)
        .delete(`/api/courses/delete/${course._id}`)
        .set(getAdminApiKeyHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await Course.findById(course._id);
      expect(deleted).toBeNull();
    });
  });

  describe('Video Management', () => {
    it('should add a video to course', async () => {
      const course = await createTestCourse();

      const res = await request(app)
        .post(`/api/courses/${course._id}/videos`)
        .set(getAdminApiKeyHeader())
        .send({
          title: 'New Video',
          description: 'A new test video',
          duration: '10:00',
          videoUrl: 'https://example.com/new-video.mp4',
          order: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.video.title).toBe('New Video');
    });

    it('should get course videos', async () => {
      const course = await createTestCourse();

      const res = await request(app)
        .get(`/api/courses/${course._id}/videos`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.videos.length).toBe(2);
    });

    it('should update a video', async () => {
      const course = await createTestCourse();
      const video = course.videos[0];

      const res = await request(app)
        .put(`/api/courses/${course._id}/videos/${video._id}`)
        .set(getAdminApiKeyHeader())
        .send({ title: 'Updated Video Title' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.video.title).toBe('Updated Video Title');
    });

    it('should delete a video', async () => {
      const course = await createTestCourse();
      const video = course.videos[0];

      const res = await request(app)
        .delete(`/api/courses/${course._id}/videos/${video._id}`)
        .set(getAdminApiKeyHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PDF Management', () => {
    it('should add a PDF to course', async () => {
      const course = await createTestCourse();

      const res = await request(app)
        .post(`/api/courses/${course._id}/pdfs`)
        .set(getAdminApiKeyHeader())
        .send({
          title: 'New PDF',
          pdfUrl: 'https://example.com/new.pdf',
          order: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.pdf.title).toBe('New PDF');
    });

    it('should get course PDFs', async () => {
      const course = await createTestCourse();

      const res = await request(app)
        .get(`/api/courses/${course._id}/pdfs`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pdfs.length).toBe(1);
    });
  });

  describe('Live Session Management', () => {
    it('should add a live session to course', async () => {
      const course = await createTestCourse();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const res = await request(app)
        .post(`/api/courses/${course._id}/livesessions`)
        .set(getAdminApiKeyHeader())
        .send({
          title: 'Live Q&A',
          description: 'Weekly live session',
          scheduledAt: futureDate.toISOString(),
          durationInMinutes: 60,
          meetingPlatform: 'zoom',
          meetingLink: 'https://zoom.us/j/123456',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.session.title).toBe('Live Q&A');
    });

    it('should get course live sessions', async () => {
      const course = await createTestCourse();

      const res = await request(app)
        .get(`/api/courses/${course._id}/livesessions`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
