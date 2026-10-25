import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupDB } from './db.js';
import {
  createTestUser,
  createTestCourse,
  createTestAdmin,
  generateUserToken,
  generateAdminToken,
  getAuthHeader,
  getAdminAuthHeader,
} from './helpers.js';
import createTestApp from './app.js';
import { Assignment } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { CourseAssessment } from '../models/courseAssessment.models.js';
import { Certificate } from '../models/certificate.models.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { upsertActiveUserMembership } from '../services/userMembership.service.js';

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
      explanation: 'Basic addition.',
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
      explanation: 'Meditation is part of the course.',
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
const adminAuth = (admin) => getAdminAuthHeader(generateAdminToken(admin._id));

describe('Certification Phase 2 API', () => {
  let user;
  let admin;
  let course;

  beforeEach(async () => {
    user = await createTestUser();
    admin = await createTestAdmin();
    course = await createTestCourse();
  });

  describe('course content sanitization', () => {
    it('never exposes quiz answer keys to users', async () => {
      const assignment = await Assignment.create({
        title: 'Practice Quiz',
        description: 'Check your learning',
        order: 0,
        isStandalone: true,
        requiredForAssessment: false,
        questions: [
          {
            questionText: 'Which answer is correct?',
            type: 'mcq',
            options: ['One', 'Two'],
            correctAnswer: 'Two',
            explanation: 'Two is the correct answer.',
          },
        ],
      });

      course.assignments.push(assignment._id);
      course.videos[0].assignments.push(assignment._id);
      await course.save();

      const byId = await request(app)
        .get(`/api/courses/${course._id}`)
        .set(userAuth(user));

      expect(byId.status).toBe(200);
      expect(JSON.stringify(byId.body)).not.toContain('correctAnswer');
      expect(JSON.stringify(byId.body)).not.toContain('explanation');

      const bySlug = await request(app)
        .get(`/api/courses/slug/${course.slug}`)
        .set(userAuth(user));

      expect(bySlug.status).toBe(200);
      expect(JSON.stringify(bySlug.body)).not.toContain('correctAnswer');

      const list = await request(app)
        .get(`/api/courses/${course._id}/assignments`)
        .set(userAuth(user));

      expect(list.status).toBe(200);
      expect(JSON.stringify(list.body)).not.toContain('correctAnswer');
      expect(JSON.stringify(list.body)).not.toContain('explanation');

      const adminView = await request(app)
        .get(`/api/courses/${course._id}`)
        .set(adminAuth(admin));

      expect(adminView.status).toBe(200);
      expect(JSON.stringify(adminView.body)).toContain('correctAnswer');
    });
  });

  describe('assessment flow', () => {
    it('locks the assessment until learning is complete and strips answer keys', async () => {
      const assessment = await createAssessment(course._id);
      const enrollment = await Enrollment.create({ userId: user._id, courseId: course._id });

      const locked = await request(app)
        .get(`/api/courses/${course._id}/assessment`)
        .set(userAuth(user));

      expect(locked.status).toBe(200);
      expect(locked.body.canStart).toBe(false);
      expect(locked.body.eligibility.assessmentUnlocked).toBe(false);

      const blockedStart = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));

      expect(blockedStart.status).toBe(403);

      await Enrollment.updateOne(
        { _id: enrollment._id },
        {
          $set: {
            completedVideos: course.videos.map((video) => video._id),
            completedPdfs: course.pdfs.map((pdf) => pdf._id),
            assessmentUnlocked: true,
            assessmentUnlockedAt: new Date(),
          },
        }
      );

      const overview = await request(app)
        .get(`/api/courses/${course._id}/assessment`)
        .set(userAuth(user));

      expect(overview.status).toBe(200);
      expect(overview.body.canStart).toBe(true);
      expect(JSON.stringify(overview.body)).not.toContain('correctOptionKey');
      expect(JSON.stringify(overview.body)).not.toContain('explanation');

      const started = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));

      expect(started.status).toBe(200);
      expect(started.body.attempt.status).toBe('in_progress');
      expect(JSON.stringify(started.body)).not.toContain('correctOptionKey');

      const answers = Object.fromEntries(
        assessment.questions.map((question) => [String(question._id), question.correctOptionKey])
      );

      const submitted = await request(app)
        .post(`/api/courses/${course._id}/assessment/submit`)
        .set(userAuth(user))
        .send({ attemptId: started.body.attempt._id, answers });

      expect(submitted.status).toBe(200);
      expect(submitted.body.result.status).toBe('graded');
      expect(submitted.body.result.passed).toBe(true);
      expect(submitted.body.result.percentage).toBe(100);
      expect(JSON.stringify(submitted.body)).not.toContain('explanation');

      const attempts = await request(app)
        .get(`/api/courses/${course._id}/assessment/attempts`)
        .set(userAuth(user));

      expect(attempts.status).toBe(200);
      expect(attempts.body.attempts).toHaveLength(1);
      expect(JSON.stringify(attempts.body)).not.toContain('correctOptionKey');
    });

    it('supports manual grading for descriptive answers', async () => {
      await createAssessment(course._id, {
        questions: [
          {
            prompt: 'Describe your daily practice.',
            type: 'descriptive',
            points: 5,
            order: 0,
          },
        ],
        passingRule: { type: 'percentage', value: 60 },
      });

      await completeEnrollment(user, course);

      const started = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));

      const assessment = await CourseAssessment.findOne({ course: course._id });
      const question = assessment.questions[0];

      const submitted = await request(app)
        .post(`/api/courses/${course._id}/assessment/submit`)
        .set(userAuth(user))
        .send({
          attemptId: started.body.attempt._id,
          answers: { [String(question._id)]: 'I meditate for twenty minutes every morning.' },
        });

      expect(submitted.status).toBe(200);
      expect(submitted.body.result.status).toBe('pending_manual');
      expect(submitted.body.result.hasManualPending).toBe(true);

      const graded = await request(app)
        .patch(`/api/admin/assessment-attempts/${started.body.attempt._id}/grade`)
        .set(adminAuth(admin))
        .send({ grades: [{ questionId: String(question._id), awardedPoints: 5 }] });

      expect(graded.status).toBe(200);
      expect(graded.body.attempt.status).toBe('graded');
      expect(graded.body.attempt.passed).toBe(true);
    });

    it('unlocks the assessment after a required quiz is passed', async () => {
      await createAssessment(course._id);

      const assignment = await Assignment.create({
        title: 'Required Quiz',
        order: 0,
        isStandalone: true,
        requiredForAssessment: true,
        questions: [
          {
            questionText: 'Pick the correct answer',
            type: 'input',
            correctAnswer: 'yes',
          },
        ],
      });
      course.assignments.push(assignment._id);
      await course.save();

      await completeEnrollment(user, course);

      const locked = await request(app)
        .get(`/api/courses/${course._id}/assessment`)
        .set(userAuth(user));

      expect(locked.body.canStart).toBe(false);
      expect(locked.body.eligibility.requiredAssignmentsComplete).toBe(false);

      const submitted = await request(app)
        .post(`/api/courses/${course._id}/assignments/${assignment._id}/submit`)
        .set(userAuth(user))
        .send({ answers: { [String(assignment.questions[0]._id)]: 'yes' } });

      expect(submitted.status).toBe(201);

      const unlocked = await request(app)
        .get(`/api/courses/${course._id}/assessment`)
        .set(userAuth(user));

      expect(unlocked.body.eligibility.requiredAssignmentsComplete).toBe(true);
      expect(unlocked.body.canStart).toBe(true);

      const enrollment = await Enrollment.findOne({ userId: user._id, courseId: course._id });
      expect(enrollment.completedRequiredAssignments.map(String)).toContain(String(assignment._id));
    });
  });

  describe('viva and certificates', () => {
    it('runs the viva workflow and issues an assessment certificate', async () => {
      await createAssessment(course._id);
      await completeEnrollment(user, course);

      const blockedViva = await request(app)
        .post(`/api/courses/${course._id}/viva/apply`)
        .set(userAuth(user));
      expect(blockedViva.status).toBe(400);

      const started = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));

      const assessment = await CourseAssessment.findOne({ course: course._id });
      const answers = Object.fromEntries(
        assessment.questions.map((question) => [String(question._id), question.correctOptionKey])
      );

      await request(app)
        .post(`/api/courses/${course._id}/assessment/submit`)
        .set(userAuth(user))
        .send({ attemptId: started.body.attempt._id, answers });

      const applied = await request(app)
        .post(`/api/courses/${course._id}/viva/apply`)
        .set(userAuth(user))
        .send({ note: 'Ready for the viva.' });

      expect(applied.status).toBe(201);
      const vivaId = applied.body.application._id;

      const duplicate = await request(app)
        .post(`/api/courses/${course._id}/viva/apply`)
        .set(userAuth(user));
      expect(duplicate.status).toBe(409);

      const vivaStatus = await request(app)
        .get(`/api/courses/${course._id}/viva`)
        .set(userAuth(user));
      expect(vivaStatus.status).toBe(200);
      expect(vivaStatus.body.application.status).toBe('applied');

      const list = await request(app)
        .get('/api/admin/viva-applications')
        .set(adminAuth(admin));
      expect(list.status).toBe(200);
      expect(list.body.applications).toHaveLength(1);

      const underReview = await request(app)
        .patch(`/api/admin/viva-applications/${vivaId}/status`)
        .set(adminAuth(admin))
        .send({ status: 'under_review' });
      expect(underReview.status).toBe(200);

      const scheduled = await request(app)
        .patch(`/api/admin/viva-applications/${vivaId}/status`)
        .set(adminAuth(admin))
        .send({
          status: 'scheduled',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          meetingLink: 'https://meet.example.com/viva',
        });
      expect(scheduled.status).toBe(200);

      const completed = await request(app)
        .patch(`/api/admin/viva-applications/${vivaId}/status`)
        .set(adminAuth(admin))
        .send({ status: 'completed' });
      expect(completed.status).toBe(200);

      const passed = await request(app)
        .patch(`/api/admin/viva-applications/${vivaId}/status`)
        .set(adminAuth(admin))
        .send({ status: 'passed', remarks: 'Clear understanding demonstrated.' });
      expect(passed.status).toBe(200);
      expect(passed.body.application.status).toBe('passed');

      const issued = await request(app)
        .post('/api/admin/certificates/assessment')
        .set(adminAuth(admin))
        .send({
          userId: String(user._id),
          courseId: String(course._id),
          vivaApplicationId: String(vivaId),
        });

      expect(issued.status).toBe(201);
      expect(issued.body.certificate.type).toBe('course_assessment');
      expect(await Certificate.countDocuments({
        user: user._id,
        type: 'course_assessment',
      })).toBe(1);

      const certificates = await request(app)
        .get('/api/user/profile/certificates?type=course_assessment')
        .set(userAuth(user));

      expect(certificates.status).toBe(200);
      expect(certificates.body.certificates).toHaveLength(1);
      expect(certificates.body.certificates[0].title).toBe('Course Assessment Certificate');

      const overview = await request(app)
        .get(`/api/courses/${course._id}/assessment`)
        .set(userAuth(user));
      expect(overview.status).toBe(200);
      expect(overview.body.attempts.completed).toBe(true);
      expect(overview.body.attempts.certificateIssued).toBe(true);
      expect(overview.body.certificate.certificateId).toBe(issued.body.certificate.certificateId);
      expect(overview.body.canStart).toBe(false);

      const blockedRetake = await request(app)
        .post(`/api/courses/${course._id}/assessment/start`)
        .set(userAuth(user));
      expect(blockedRetake.status).toBe(409);
      expect(blockedRetake.body.code).toBe('ASSESSMENT_COMPLETED');

      const view = await request(app)
        .get(`/api/certificates/${issued.body.certificate.certificateId}/view`);
      expect(view.status).toBe(200);
      expect(view.text).toContain('Course Assessment Certificate');
      expect(view.text).toContain(user.displayName);
    });

    it('issues a membership certificate after a verified membership purchase', async () => {
      await MembershipPlan.create({
        title: 'Gold Membership',
        slug: 'gold',
        pricing: { oneTime: { amount: 1000, currency: 'INR' } },
        status: 'published',
      });

      await upsertActiveUserMembership({
        userId: user._id,
        planSlug: 'gold',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000 * 30),
        source: 'purchase',
        payment: {
          provider: 'razorpay',
          orderId: 'order_membership_1',
          paymentId: 'pay_membership_1',
          amount: 1000,
          currency: 'INR',
        },
      });

      const certificate = await Certificate.findOne({
        user: user._id,
        type: 'membership',
      });

      expect(certificate).toBeTruthy();
      expect(certificate.title).toBe('Membership Certificate');
    });
  });

  describe('progress hardening', () => {
    it('rejects video and PDF progress for content outside the course', async () => {
      await Enrollment.create({ userId: user._id, courseId: course._id });

      const invalidVideo = await request(app)
        .post(`/api/courses/${course._id}/progress/video/${oid()}`)
        .set(userAuth(user));
      expect(invalidVideo.status).toBe(404);

      const invalidPdf = await request(app)
        .post(`/api/courses/${course._id}/progress/pdf/${oid()}`)
        .set(userAuth(user));
      expect(invalidPdf.status).toBe(404);

      const enrollment = await Enrollment.findOne({ userId: user._id, courseId: course._id });
      expect(enrollment.completedVideos).toHaveLength(0);
      expect(enrollment.completedPdfs).toHaveLength(0);
    });
  });
});
