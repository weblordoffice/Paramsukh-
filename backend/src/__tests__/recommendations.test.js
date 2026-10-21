import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { User } from '../models/user.models.js';
import { Course } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import Assessment from '../models/assessment.models.js';
import { createTestUser, generateUserToken, getAuthHeader } from './helpers.js';

setupDB();

const app = createTestApp();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

describe('AI course recommendations', () => {
  let user;
  let token;

  beforeEach(async () => {
    await User.deleteMany({});
    await Course.deleteMany({});
    await Enrollment.deleteMany({});
    await Assessment.deleteMany({});

    user = await createTestUser({
      phone: `+91${uid()}`,
      email: `recs-${uid()}@test.com`,
      displayName: 'Recommendation User',
    });
    token = generateUserToken(user._id);

    await Assessment.create({
      user: user._id,
      birthDate: new Date('1995-05-15'),
      age: 31,
      occupation: 'Engineer',
      location: 'Delhi, India',
      stressLevel: 9,
      sleepQuality: 3,
      energyLevel: 4,
      moodRating: 4,
      physicalActivityLevel: 'light',
      physicalIssue: false,
      specialDiseaseIssue: false,
      relationshipIssue: false,
      financialIssue: false,
      mentalHealthIssue: true,
      spiritualGrowth: true,
    });
  });

  it('should return personalized recommendations with explanations and exclude enrolled courses', async () => {
    const mentalCourse = await Course.create({
      title: 'Mental Wellness Foundations',
      description: 'Learn mindfulness and stress management.',
      category: 'mental',
      duration: '2 hours',
      status: 'published',
      tags: ['meditation', 'stress', 'mindfulness', 'calm'],
      videos: [],
      pdfs: [],
    });

    const enrolledCourse = await Course.create({
      title: 'Already Enrolled Mental Course',
      description: 'Should not be recommended.',
      category: 'mental',
      duration: '1 hour',
      status: 'published',
      tags: ['meditation'],
      videos: [],
      pdfs: [],
    });

    await Course.create({
      title: 'Spiritual Growth Path',
      description: 'Meditation and consciousness.',
      category: 'spiritual',
      duration: '3 hours',
      status: 'published',
      tags: ['meditation', 'consciousness', 'wisdom'],
      videos: [],
      pdfs: [],
    });

    await Enrollment.create({
      userId: user._id,
      courseId: enrolledCourse._id,
      progress: 10,
    });

    const res = await request(app)
      .get('/api/assessment/recommendations')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);

    const ids = res.body.recommendations.map((course) => String(course._id));
    expect(ids).toContain(String(mentalCourse._id));
    expect(ids).not.toContain(String(enrolledCourse._id));

    const recommendation = res.body.recommendations.find(
      (course) => String(course._id) === String(mentalCourse._id)
    );
    expect(typeof recommendation.whyThisFits).toBe('string');
    expect(recommendation.whyThisFits.length).toBeGreaterThan(0);
    expect(recommendation.recommendationScore).toBeGreaterThan(0);
  });

  it('should return an empty list when the assessment is missing', async () => {
    await Assessment.deleteMany({});

    const res = await request(app)
      .get('/api/assessment/recommendations')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.recommendations).toEqual([]);
  });
});
