import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { Course, Assignment } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { CourseActivitySubmission } from '../models/courseActivitySubmission.models.js';
import {
  createTestUser,
  generateUserToken,
  getAuthHeader,
  getAdminApiKeyHeader,
} from './helpers.js';

setupDB();

const app = createTestApp();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

describe('Course activities - audio, reflections, quizzes', () => {
  let user;
  let token;
  let course;
  let enrollment;

  beforeEach(async () => {
    await Course.deleteMany({});
    await Enrollment.deleteMany({});
    await CourseActivitySubmission.deleteMany({});
    await Assignment.deleteMany({});

    user = await createTestUser({
      phone: `+91${uid()}`,
      email: `activities-${uid()}@test.com`,
      displayName: 'Activity Learner',
    });
    token = generateUserToken(user._id);

    course = await Course.create({
      title: 'Activity Course',
      description: 'Course with audio, reflections and quizzes',
      category: 'mental',
      duration: '2 hours',
      status: 'published',
      videos: [],
      pdfs: [],
    });

    enrollment = await Enrollment.create({
      userId: user._id,
      courseId: course._id,
      progress: 0,
    });
  });

  it('should add audio lessons, mark them complete, and include them in progress', async () => {
    const created = await request(app)
      .post(`/api/courses/${course._id}/audio-lessons`)
      .set(getAdminApiKeyHeader())
      .send({
        title: 'Morning Breathing',
        audioUrl: 'https://cdn.example.com/breathing.mp3',
        duration: '10:00',
        order: 0,
      });

    expect(created.status).toBe(201);

    const list = await request(app)
      .get(`/api/courses/${course._id}/audio-lessons`)
      .set(getAuthHeader(token));
    expect(list.status).toBe(200);
    expect(list.body.audioLessons).toHaveLength(1);
    expect(list.body.audioLessons[0].isCompleted).toBe(false);

    const completed = await request(app)
      .post(`/api/courses/${course._id}/progress/audio/${created.body.audioLesson._id}`)
      .set(getAuthHeader(token));

    expect(completed.status).toBe(400);

    await request(app)
      .patch(`/api/enrollments/course/${course._id}/audio/${created.body.audioLesson._id}/position`)
      .set(getAuthHeader(token))
      .send({ positionSeconds: 95, durationSeconds: 100 });

    const completedWithProof = await request(app)
      .post(`/api/courses/${course._id}/progress/audio/${created.body.audioLesson._id}`)
      .set(getAuthHeader(token));

    expect(completedWithProof.status).toBe(200);
    expect(completedWithProof.body.data.completedAudioLessons).toContain(String(created.body.audioLesson._id));
    expect(completedWithProof.body.data.progress).toBe(100);
  });

  it('should submit reflections with minimum-word validation and update progress', async () => {
    const created = await request(app)
      .post(`/api/courses/${course._id}/reflections`)
      .set(getAdminApiKeyHeader())
      .send({
        title: 'Gratitude Reflection',
        prompt: 'What are you grateful for today?',
        guidance: 'Write honestly and specifically.',
        minWords: 5,
        order: 0,
      });

    expect(created.status).toBe(201);
    const reflectionId = created.body.reflection._id;

    const tooShort = await request(app)
      .post(`/api/courses/${course._id}/reflections/${reflectionId}/submit`)
      .set(getAuthHeader(token))
      .send({ response: 'I am grateful' });
    expect(tooShort.status).toBe(400);

    const submitted = await request(app)
      .post(`/api/courses/${course._id}/reflections/${reflectionId}/submit`)
      .set(getAuthHeader(token))
      .send({ response: 'I am grateful for my family, my health, and the opportunity to learn every day.' });

    expect(submitted.status).toBe(200);
    expect(submitted.body.submission.response).toContain('grateful');
    expect(submitted.body.progress).toBe(100);
    expect(submitted.body.isCompleted).toBe(true);

    const reflections = await request(app)
      .get(`/api/courses/${course._id}/reflections`)
      .set(getAuthHeader(token));
    expect(reflections.status).toBe(200);
    expect(reflections.body.reflections[0].isCompleted).toBe(true);
    expect(reflections.body.reflections[0].submission.response).toContain('grateful');
  });

  it('should score quiz attempts on the server and track best score', async () => {
    const assignment = await Assignment.create({
      title: 'Mindfulness Quiz',
      description: 'Check your understanding',
      order: 0,
      isStandalone: true,
      questions: [
        {
          questionText: 'Which practice focuses on the present moment?',
          type: 'mcq',
          options: ['Multitasking', 'Mindfulness', 'Rumination'],
          correctAnswer: 'Mindfulness',
          explanation: 'Mindfulness is present-moment awareness.',
        },
        {
          questionText: 'What does gratitude practice improve?',
          type: 'mcq',
          options: ['Well-being', 'Stress', 'Isolation'],
          correctAnswer: 'Well-being',
          explanation: 'Gratitude is linked with improved well-being.',
        },
      ],
    });

    course.assignments.push(assignment._id);
    await course.save();

    const questions = assignment.questions;
    const correctAnswers = {
      [questions[0]._id]: 'Mindfulness',
      [questions[1]._id]: 'Well-being',
    };

    const first = await request(app)
      .post(`/api/courses/${course._id}/assignments/${assignment._id}/submit`)
      .set(getAuthHeader(token))
      .send({ answers: correctAnswers });

    expect(first.status).toBe(201);
    expect(first.body.submission.score).toBe(2);
    expect(first.body.submission.maxScore).toBe(2);
    expect(first.body.submission.percentage).toBe(100);
    expect(first.body.submission.passed).toBe(true);
    expect(first.body.submission.attemptNumber).toBe(1);

    const second = await request(app)
      .post(`/api/courses/${course._id}/assignments/${assignment._id}/submit`)
      .set(getAuthHeader(token))
      .send({
        answers: {
          [questions[0]._id]: 'Multitasking',
          [questions[1]._id]: 'Well-being',
        },
      });

    expect(second.status).toBe(201);
    expect(second.body.submission.score).toBe(1);
    expect(second.body.submission.percentage).toBe(50);
    expect(second.body.submission.passed).toBe(false);
    expect(second.body.submission.attemptNumber).toBe(2);
    expect(second.body.best.percentage).toBe(100);
    expect(second.body.attempts).toHaveLength(2);

    const attempts = await request(app)
      .get(`/api/courses/${course._id}/assignments/${assignment._id}/attempts`)
      .set(getAuthHeader(token));
    expect(attempts.status).toBe(200);
    expect(attempts.body.best.percentage).toBe(100);
  });
});
