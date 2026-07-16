import request from 'supertest';
import createTestApp from './app.js';
import { Group, Post, Comment } from '../models/community.models.js';
import { Course } from '../models/course.models.js';
import {
  createTestUser,
  generateUserToken,
  getAuthHeader,
  getAdminApiKeyHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

const createTestGroup = async (overrides = {}) => {
  const type = overrides.groupType || 'course';
  let courseId = overrides.courseId;
  if (type === 'course' && !courseId) {
    const course = await Course.create({
      title: 'Dummy Course for Group',
      description: 'Dummy Description',
      instructor: 'Instructor',
      level: 'beginner',
      category: 'spiritual',
      duration: '2 hours',
      lessonsCount: 1,
      isActive: true,
      price: 0
    });
    courseId = course._id;
  }

  const group = await Group.create({
    name: 'Test Group',
    description: 'A test community group',
    groupType: type,
    courseId,
    isActive: true,
    ...overrides,
  });
  return group;
};

describe('Community Module - /api/community', () => {
  let user;
  let token;
  let group;

  beforeEach(async () => {
    // Create Pro plan to satisfy integrity check
    const { MembershipPlan } = await import('../models/membershipPlan.models.js');
    await MembershipPlan.findOneAndUpdate(
      { slug: 'pro' },
      {
        title: 'Pro Plan',
        slug: 'pro',
        description: 'Test Pro Plan',
        price: 999,
        duration: 'month',
        isActive: true,
        access: {
          communityAccess: true,
          accessMode: 'entitlement_only'
        }
      },
      { upsert: true, new: true }
    );

    user = await createTestUser({
      assessmentCompleted: true,
      subscriptionPlan: 'pro',
      subscriptionStatus: 'active'
    });
    token = generateUserToken(user._id);
    group = await createTestGroup({ memberCount: 1 });

    const { GroupMember } = await import('../models/community.models.js');
    await GroupMember.create({
      groupId: group._id,
      userId: user._id,
      role: 'member',
      isActive: true
    });
  });

  describe('GET /api/community/check-access', () => {
    it('should return accessible groups', async () => {
      const res = await request(app)
        .get('/api/community/check-access')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/community/my-groups', () => {
    it('should return user groups', async () => {
      const res = await request(app)
        .get('/api/community/my-groups')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/community/groups/:id/posts', () => {
    it('should return group posts', async () => {
      await Post.create({
        groupId: group._id,
        userId: user._id,
        content: 'Hello, this is a test post.',
      });

      const res = await request(app)
        .get(`/api/community/groups/${group._id}/posts`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent group', async () => {
      const res = await request(app)
        .get('/api/community/groups/5f7b3a2b9d3e2a1b2c3d4e5f/posts')
        .set(getAuthHeader(token));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/community/groups/:id/posts', () => {
    it('should create a post with valid data', async () => {
      const res = await request(app)
        .post(`/api/community/groups/${group._id}/posts`)
        .set(getAuthHeader(token))
        .send({ content: 'This is a new post from tests.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.post.content).toBe('This is a new post from tests.');
    });

    it('should reject empty content', async () => {
      const res = await request(app)
        .post(`/api/community/groups/${group._id}/posts`)
        .set(getAuthHeader(token))
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/community/posts/:postId/like', () => {
    it('should toggle like on a post', async () => {
      const post = await Post.create({
        groupId: group._id,
        userId: user._id,
        content: 'Like me!',
      });

      const res = await request(app)
        .post(`/api/community/posts/${post._id}/like`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/community/posts/:postId/comments', () => {
    it('should add a comment to a post', async () => {
      const post = await Post.create({
        groupId: group._id,
        userId: user._id,
        content: 'Post for comments.',
      });

      const res = await request(app)
        .post(`/api/community/posts/${post._id}/comments`)
        .set(getAuthHeader(token))
        .send({ content: 'Great post!' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/community/posts/:postId', () => {
    it('should delete own post', async () => {
      const post = await Post.create({
        groupId: group._id,
        userId: user._id,
        content: 'To be deleted.',
      });

      const res = await request(app)
        .delete(`/api/community/posts/${post._id}`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/community/posts/:postId/comments', () => {
    it('should return post comments', async () => {
      const post = await Post.create({
        groupId: group._id,
        userId: user._id,
        content: 'With comments.',
      });

      await Comment.create({
        postId: post._id,
        userId: user._id,
        content: 'Test comment.',
      });

      const res = await request(app)
        .get(`/api/community/posts/${post._id}/comments`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
