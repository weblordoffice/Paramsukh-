import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { User } from '../models/user.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { Course } from '../models/course.models.js';
import Assessment from '../models/assessment.models.js';
import Certificate from '../models/certificate.models.js';
import { getAuthHeader, generateUserToken } from './helpers.js';

setupDB();

const app = createTestApp();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

describe('Profile & Progress Management', () => {
  let user;
  let token;

  beforeEach(async () => {
    await User.deleteMany({});
    await Assessment.deleteMany({});
    await Enrollment.deleteMany({});
    await Course.deleteMany({});
    await Certificate.deleteMany({});

    user = await User.create({
      phone: `+91${uid()}`,
      displayName: 'Profile Tester',
      email: `${uid()}@test.com`,
      authProvider: 'phone'
    });

    token = generateUserToken(user._id);

    // Register active device session for test user
    const { DeviceSession } = await import('../models/deviceSession.models.js');
    await DeviceSession.create({
      user: user._id,
      deviceId: 'test-device-id',
      deviceName: 'Test Phone',
      os: 'iOS',
      browser: 'App',
      authProvider: 'phone'
    });
  });

  it('should fetch user profile along with assessment details', async () => {
    // Create pre-existing assessment record
    await Assessment.create({
      user: user._id,
      age: 28,
      occupation: 'Engineer',
      location: 'Bangalore, India',
      physicalIssue: false,
      specialDiseaseIssue: false,
      relationshipIssue: true,
      financialIssue: false,
      mentalHealthIssue: true,
      spiritualGrowth: true
    });

    const res = await request(app)
      .get('/api/user/profile')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.displayName).toBe('Profile Tester');
    expect(res.body.profileDetails).not.toBeNull();
    expect(res.body.profileDetails.age).toBe(28);
    expect(res.body.profileDetails.occupation).toBe('Engineer');
    expect(res.body.profileDetails.relationshipIssue).toBe(true);
  });

  it('should update profile name and assessment fields successfully', async () => {
    const updatePayload = {
      displayName: 'Updated Name',
      age: 35,
      occupation: 'Architect',
      location: 'Delhi, India',
      physicalIssue: true,
      spiritualGrowth: true
    };

    const res = await request(app)
      .put('/api/user/profile')
      .set(getAuthHeader(token))
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.displayName).toBe('Updated Name');
    expect(res.body.profileDetails.age).toBe(35);
    expect(res.body.profileDetails.occupation).toBe('Architect');
    expect(res.body.profileDetails.physicalIssue).toBe(true);
    expect(res.body.profileDetails.spiritualGrowth).toBe(true);

    // Verify it persists in DB
    const dbAssessment = await Assessment.findOne({ user: user._id });
    expect(dbAssessment.age).toBe(35);
    expect(dbAssessment.occupation).toBe('Architect');
  });

  it('should trigger certificate generation on course completion', async () => {
    // Create dummy course
    const course = await Course.create({
      title: 'Meditation Masterclass',
      description: 'Learn to meditate',
      category: 'Mental Wellness',
      duration: '2 hours',
      videos: [{ 
        title: 'Intro', 
        videoUrl: 'http://test.com/1', 
        duration: 120,
        order: 1
      }],
      pdfs: []
    });

    // Create enrollment
    await Enrollment.create({
      userId: user._id,
      courseId: course._id,
      progress: 0,
      completedVideos: []
    });

    // Mark the video complete to reach 100% progress
    const res = await request(app)
      .post(`/api/courses/${course._id}/progress/video/${course.videos[0]._id}`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.isCompleted).toBe(true);

    // Verify certificate created in DB
    const cert = await Certificate.findOne({ user: user._id, course: course._id });
    expect(cert).not.toBeNull();
    expect(cert.courseName).toBe('Meditation Masterclass');
    expect(cert.issuedTo).toBe('Profile Tester');
  });

  it('should list all user earned certificates', async () => {
    // Manually create certificate
    await Certificate.create({
      certificateId: 'TEST-CERT-1234',
      user: user._id,
      course: '5f7b3a2b9d3e2a1b2c3d4e5f',
      issuedTo: 'Profile Tester',
      courseName: 'Spiritual Awakening'
    });

    const res = await request(app)
      .get('/api/user/profile/certificates')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.certificates).toHaveLength(1);
    expect(res.body.certificates[0].certificateId).toBe('TEST-CERT-1234');
    expect(res.body.certificates[0].courseName).toBe('Spiritual Awakening');
  });

  it('should unlock badge achievements automatically on milestones', async () => {
    // Create enrollment to satisfy first-step badge criteria (totalEnrollments >= 1)
    await Enrollment.create({
      userId: user._id,
      courseId: '5f7b3a2b9d3e2a1b2c3d4e5f',
      progress: 10
    });

    // Trigger badge evaluation by simulating a login/OTP verification
    const { unlockBadgesForUser } = await import('../services/badgeUnlockingService.js');
    const unlocked = await unlockBadgesForUser(user._id);

    // Should unlock the first-step badge
    expect(unlocked).toContain('first-step');

    // Retrieve user and check unlockedBadges
    const dbUser = await User.findById(user._id);
    expect(dbUser.unlockedBadges.some(b => b.badgeId === 'first-step')).toBe(true);
  });
});
