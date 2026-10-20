import request from 'supertest';
import mongoose from 'mongoose';
import createTestApp from './app.js';
import { Group, Post, Comment, MentorProfile } from '../models/community.models.js';
import { Course } from '../models/course.models.js';
import { CommunityPointEvent } from '../models/communityPoint.models.js';
import { getWeekKey, getMonthKey } from '../services/communityPoints.service.js';
import { assignMentorToGroup } from '../services/community.service.js';
import {
  createTestUser,
  createTestUser2,
  createTestDeviceSession,
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

  describe('GET /api/community/feed', () => {
    it('should return posts from all of the user\'s groups', async () => {
      await Post.create({
        groupId: group._id,
        userId: user._id,
        content: 'A post that should appear in the combined feed.',
      });

      const res = await request(app)
        .get('/api/community/feed')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.posts)).toBe(true);
      expect(res.body.posts.some(p => p.content === 'A post that should appear in the combined feed.')).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/community/feed');
      expect(res.status).toBe(401);
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

  describe('Question Boards', () => {
    const createQuestion = async (overrides = {}) => {
      return request(app)
        .post(`/api/community/groups/${group._id}/posts`)
        .set(getAuthHeader(token))
        .send({
          postType: 'question',
          title: 'How do I manage exam stress?',
          content: 'I feel anxious before exams. Any practical techniques?',
          ...overrides,
        });
    };

    it('should create a question with a title', async () => {
      const res = await createQuestion();

      expect(res.status).toBe(201);
      expect(res.body.post.postType).toBe('question');
      expect(res.body.post.title).toBe('How do I manage exam stress?');
      expect(res.body.post.isResolved).toBe(false);
    });

    it('should reject a question without a title', async () => {
      const res = await createQuestion({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should keep questions out of the discussion channels', async () => {
      await createQuestion();
      await Post.create({
        groupId: group._id,
        userId: user._id,
        content: 'A regular discussion post.',
      });

      const feedRes = await request(app)
        .get('/api/community/feed')
        .set(getAuthHeader(token));

      expect(feedRes.status).toBe(200);
      expect(feedRes.body.posts.some((p) => p.content === 'A regular discussion post.')).toBe(true);
      expect(feedRes.body.posts.some((p) => p.postType === 'question')).toBe(false);
    });

    it('should treat legacy posts without postType as discussions', async () => {
      const insert = await Post.collection.insertOne({
        groupId: group._id,
        userId: user._id,
        content: 'Legacy post without postType.',
        images: [],
        likes: [],
        likeCount: 0,
        commentCount: 0,
        isPinned: false,
        isBlocked: false,
        isActive: true,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const discussionRes = await request(app)
        .get(`/api/community/groups/${group._id}/posts?postType=discussion`)
        .set(getAuthHeader(token));
      expect(discussionRes.body.posts.some((p) => p._id === String(insert.insertedId))).toBe(true);

      const questionRes = await request(app)
        .get(`/api/community/groups/${group._id}/posts?postType=question`)
        .set(getAuthHeader(token));
      expect(questionRes.body.posts.some((p) => p._id === String(insert.insertedId))).toBe(false);
    });

    it('should return questions with the question filter', async () => {
      await createQuestion();
      await Post.create({
        groupId: group._id,
        userId: user._id,
        content: 'A regular discussion post.',
      });

      const res = await request(app)
        .get(`/api/community/groups/${group._id}/posts?postType=question`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.posts.length).toBe(1);
      expect(res.body.posts[0].postType).toBe('question');
    });

    it('should filter unanswered and resolved questions', async () => {
      const created = await createQuestion();
      const questionId = created.body.post._id;

      const unanswered = await request(app)
        .get(`/api/community/groups/${group._id}/posts?postType=question&status=unanswered`)
        .set(getAuthHeader(token));
      expect(unanswered.body.posts.some((p) => p._id === questionId)).toBe(true);

      await request(app)
        .patch(`/api/community/posts/${questionId}/resolve`)
        .set(getAuthHeader(token))
        .send({ resolved: true });

      const resolved = await request(app)
        .get(`/api/community/groups/${group._id}/posts?postType=question&status=resolved`)
        .set(getAuthHeader(token));
      expect(resolved.body.posts.some((p) => p._id === questionId)).toBe(true);

      const stillUnanswered = await request(app)
        .get(`/api/community/groups/${group._id}/posts?postType=question&status=unanswered`)
        .set(getAuthHeader(token));
      expect(stillUnanswered.body.posts.some((p) => p._id === questionId)).toBe(false);
    });

    it('should toggle votes on a question', async () => {
      const created = await createQuestion();
      const questionId = created.body.post._id;

      const vote = await request(app)
        .post(`/api/community/posts/${questionId}/vote`)
        .set(getAuthHeader(token));
      expect(vote.status).toBe(200);
      expect(vote.body.voted).toBe(true);
      expect(vote.body.voteCount).toBe(1);

      const unvote = await request(app)
        .post(`/api/community/posts/${questionId}/vote`)
        .set(getAuthHeader(token));
      expect(unvote.body.voted).toBe(false);
      expect(unvote.body.voteCount).toBe(0);
    });

    it('should reject votes on discussions', async () => {
      const post = await Post.create({
        groupId: group._id,
        userId: user._id,
        content: 'Not a question.',
      });

      const res = await request(app)
        .post(`/api/community/posts/${post._id}/vote`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(400);
    });

    it('should let the author accept an answer', async () => {
      const created = await createQuestion();
      const questionId = created.body.post._id;

      const answerer = await createTestUser2({ subscriptionPlan: 'pro', subscriptionStatus: 'active' });
      await createTestDeviceSession(answerer._id);
      const answererToken = generateUserToken(answerer._id);
      const { GroupMember } = await import('../models/community.models.js');
      await GroupMember.create({
        groupId: group._id,
        userId: answerer._id,
        role: 'member',
        isActive: true,
      });

      const commentRes = await request(app)
        .post(`/api/community/posts/${questionId}/comments`)
        .set(getAuthHeader(answererToken))
        .send({ content: 'Try box breathing for five minutes.' });
      expect(commentRes.status).toBe(201);

      const answerId = commentRes.body.comment._id;
      const accept = await request(app)
        .patch(`/api/community/posts/${questionId}/accept-answer`)
        .set(getAuthHeader(token))
        .send({ commentId: answerId });

      expect(accept.status).toBe(200);
      expect(accept.body.isResolved).toBe(true);
      expect(String(accept.body.acceptedCommentId)).toBe(String(answerId));

      const comments = await request(app)
        .get(`/api/community/posts/${questionId}/comments`)
        .set(getAuthHeader(token));
      expect(comments.body.comments[0].isAccepted).toBe(true);
    });

    it('should not allow accepting your own answer', async () => {
      const created = await createQuestion();
      const questionId = created.body.post._id;

      const commentRes = await request(app)
        .post(`/api/community/posts/${questionId}/comments`)
        .set(getAuthHeader(token))
        .send({ content: 'My own follow-up.' });

      const accept = await request(app)
        .patch(`/api/community/posts/${questionId}/accept-answer`)
        .set(getAuthHeader(token))
        .send({ commentId: commentRes.body.comment._id });

      expect(accept.status).toBe(400);
    });

    it('should prevent non-author members from accepting an answer', async () => {
      const created = await createQuestion();
      const questionId = created.body.post._id;

      const otherUser = await createTestUser2({ subscriptionPlan: 'pro', subscriptionStatus: 'active' });
      await createTestDeviceSession(otherUser._id);
      const otherToken = generateUserToken(otherUser._id);
      const { GroupMember } = await import('../models/community.models.js');
      await GroupMember.create({
        groupId: group._id,
        userId: otherUser._id,
        role: 'member',
        isActive: true,
      });

      const comment = await Comment.create({
        postId: questionId,
        userId: user._id,
        content: 'An answer from the author.',
      });

      const accept = await request(app)
        .patch(`/api/community/posts/${questionId}/accept-answer`)
        .set(getAuthHeader(otherToken))
        .send({ commentId: comment._id });

      expect(accept.status).toBe(403);
    });

    it('should let an admin resolve and accept an answer', async () => {
      const created = await createQuestion();
      const questionId = created.body.post._id;

      const comment = await Comment.create({
        postId: questionId,
        userId: user._id,
        content: 'Admin-accepted answer.',
      });

      const accept = await request(app)
        .patch(`/api/community/admin/posts/${questionId}/accept-answer`)
        .set(getAdminApiKeyHeader())
        .send({ commentId: comment._id });

      expect(accept.status).toBe(200);
      expect(accept.body.data.isResolved).toBe(true);

      const resolve = await request(app)
        .patch(`/api/community/admin/posts/${questionId}/resolve`)
        .set(getAdminApiKeyHeader())
        .send({ resolved: false });

      expect(resolve.status).toBe(200);
      expect(resolve.body.data.isResolved).toBe(false);
    });
  });

  describe('Community Leaderboard', () => {
    const createPointEvent = async ({
      userId: eventUserId,
      points,
      action = 'comment_created',
      groupId: eventGroupId = null,
      weekKey = getWeekKey(),
      monthKey = getMonthKey(),
      dedupeKey,
    }) => {
      return CommunityPointEvent.create({
        userId: eventUserId,
        action,
        points,
        refType: action === 'comment_created' ? 'comment' : 'post',
        refId: new mongoose.Types.ObjectId(),
        groupId: eventGroupId,
        weekKey,
        monthKey,
        dedupeKey,
      });
    };

    it('should award points when a question is created', async () => {
      const created = await request(app)
        .post(`/api/community/groups/${group._id}/posts`)
        .set(getAuthHeader(token))
        .send({
          postType: 'question',
          title: 'How do I build a morning routine?',
          content: 'Looking for practical tips.',
        });

      expect(created.status).toBe(201);

      const event = await CommunityPointEvent.findOne({
        userId: user._id,
        action: 'question_created',
        refId: created.body.post._id,
        isActive: true,
      }).lean();

      expect(event).toBeTruthy();
      expect(event.points).toBe(5);
    });

    it('should cap discussion creation points per day', async () => {
      for (let i = 0; i < 4; i += 1) {
        const res = await request(app)
          .post(`/api/community/groups/${group._id}/posts`)
          .set(getAuthHeader(token))
          .send({ content: `Daily cap discussion ${i}` });
        expect(res.status).toBe(201);
      }

      const count = await CommunityPointEvent.countDocuments({
        userId: user._id,
        action: 'discussion_created',
        isActive: true,
      });

      expect(count).toBe(3);
    });

    it('should award points when an answer is accepted', async () => {
      const created = await request(app)
        .post(`/api/community/groups/${group._id}/posts`)
        .set(getAuthHeader(token))
        .send({
          postType: 'question',
          title: 'How do I sleep better?',
          content: 'I struggle to fall asleep.',
        });

      const questionId = created.body.post._id;
      const answerer = await createTestUser2({ subscriptionPlan: 'pro', subscriptionStatus: 'active' });
      await createTestDeviceSession(answerer._id);
      const answererToken = generateUserToken(answerer._id);

      const { GroupMember } = await import('../models/community.models.js');
      await GroupMember.create({
        groupId: group._id,
        userId: answerer._id,
        role: 'member',
        isActive: true,
      });

      const answer = await request(app)
        .post(`/api/community/posts/${questionId}/comments`)
        .set(getAuthHeader(answererToken))
        .send({ content: 'Try a consistent sleep schedule.' });

      const accepted = await request(app)
        .patch(`/api/community/posts/${questionId}/accept-answer`)
        .set(getAuthHeader(token))
        .send({ commentId: answer.body.comment._id });

      expect(accepted.status).toBe(200);

      const event = await CommunityPointEvent.findOne({
        userId: answerer._id,
        action: 'answer_accepted',
        isActive: true,
      }).lean();

      expect(event).toBeTruthy();
      expect(event.points).toBe(20);
    });

    it('should revoke like points when a like is removed', async () => {
      const author = await createTestUser2({ subscriptionPlan: 'pro', subscriptionStatus: 'active' });
      const post = await Post.create({
        groupId: group._id,
        userId: author._id,
        content: 'Like and unlike me.',
      });

      const like = await request(app)
        .post(`/api/community/posts/${post._id}/like`)
        .set(getAuthHeader(token));
      expect(like.body.liked).toBe(true);

      let event = await CommunityPointEvent.findOne({
        dedupeKey: `like:${post._id}:${user._id}`,
      }).lean();
      expect(event?.isActive).toBe(true);
      expect(event?.points).toBe(1);

      const unlike = await request(app)
        .post(`/api/community/posts/${post._id}/like`)
        .set(getAuthHeader(token));
      expect(unlike.body.liked).toBe(false);

      event = await CommunityPointEvent.findOne({
        dedupeKey: `like:${post._id}:${user._id}`,
      }).lean();
      expect(event?.isActive).toBe(false);
    });

    it('should revoke upvote points when a vote is removed', async () => {
      const author = await createTestUser2({ subscriptionPlan: 'pro', subscriptionStatus: 'active' });
      const question = await Post.create({
        groupId: group._id,
        userId: author._id,
        postType: 'question',
        title: 'Vote for this question?',
        content: 'Testing upvotes.',
      });

      const vote = await request(app)
        .post(`/api/community/posts/${question._id}/vote`)
        .set(getAuthHeader(token));
      expect(vote.body.voted).toBe(true);

      let event = await CommunityPointEvent.findOne({
        dedupeKey: `vote:${question._id}:${user._id}`,
      }).lean();
      expect(event?.isActive).toBe(true);
      expect(event?.points).toBe(1);

      const unvote = await request(app)
        .post(`/api/community/posts/${question._id}/vote`)
        .set(getAuthHeader(token));
      expect(unvote.body.voted).toBe(false);

      event = await CommunityPointEvent.findOne({
        dedupeKey: `vote:${question._id}:${user._id}`,
      }).lean();
      expect(event?.isActive).toBe(false);
    });

    it('should return the leaderboard with the current user rank', async () => {
      const other = await createTestUser2({ subscriptionPlan: 'pro', subscriptionStatus: 'active' });

      await createPointEvent({
        userId: other._id,
        points: 50,
        dedupeKey: 'test:leaderboard:other',
      });
      await createPointEvent({
        userId: user._id,
        points: 30,
        dedupeKey: 'test:leaderboard:me',
      });

      const res = await request(app)
        .get('/api/community/leaderboard?period=all')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.leaderboard[0].userId).toBe(String(other._id));
      expect(res.body.leaderboard[1].userId).toBe(String(user._id));
      expect(res.body.me.rank).toBe(2);
      expect(res.body.me.points).toBe(30);
    });

    it('should scope the leaderboard to a group and its subgroups', async () => {
      const other = await createTestUser2({ subscriptionPlan: 'pro', subscriptionStatus: 'active' });
      const otherGroup = await createTestGroup({ name: 'Other Group' });

      await createPointEvent({
        userId: user._id,
        points: 20,
        groupId: group._id,
        dedupeKey: 'test:scope:group',
      });
      await createPointEvent({
        userId: other._id,
        points: 80,
        groupId: otherGroup._id,
        dedupeKey: 'test:scope:other',
      });

      const res = await request(app)
        .get(`/api/community/leaderboard?period=all&groupId=${group._id}`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.leaderboard).toHaveLength(1);
      expect(res.body.leaderboard[0].userId).toBe(String(user._id));
      expect(res.body.leaderboard[0].points).toBe(20);
    });

    it('should exclude mentors from the leaderboard', async () => {
      const mentor = await createTestUser2({ subscriptionPlan: 'pro', subscriptionStatus: 'active' });
      const { GroupMember } = await import('../models/community.models.js');
      await GroupMember.create({
        groupId: group._id,
        userId: mentor._id,
        role: 'mentor',
        isActive: true,
      });
      await MentorProfile.create({
        userId: mentor._id,
        headline: 'Wellness mentor',
        groupIds: [group._id],
        isActive: true,
        isVerified: true,
      });
      await createPointEvent({
        userId: mentor._id,
        points: 100,
        dedupeKey: 'test:mentor:excluded',
      });

      const res = await request(app)
        .get('/api/community/leaderboard?period=all')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.leaderboard.some((entry) => entry.userId === String(mentor._id))).toBe(false);
    });

    it('should filter weekly points', async () => {
      await createPointEvent({
        userId: user._id,
        points: 25,
        dedupeKey: 'test:weekly:current',
      });
      await createPointEvent({
        userId: user._id,
        points: 100,
        weekKey: '2020-W01',
        monthKey: '2020-01',
        dedupeKey: 'test:weekly:old',
      });

      const res = await request(app)
        .get('/api/community/leaderboard?period=weekly')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.leaderboard[0].points).toBe(25);
    });

    it('should expose admin leaderboard and point events', async () => {
      await createPointEvent({
        userId: user._id,
        points: 15,
        dedupeKey: 'test:admin:leaderboard',
      });

      const leaderboardRes = await request(app)
        .get('/api/community/admin/leaderboard?period=all')
        .set(getAdminApiKeyHeader());
      expect(leaderboardRes.status).toBe(200);
      expect(leaderboardRes.body.leaderboard[0].points).toBe(15);

      const eventsRes = await request(app)
        .get('/api/community/admin/leaderboard/events?period=all')
        .set(getAdminApiKeyHeader());
      expect(eventsRes.status).toBe(200);
      expect(Array.isArray(eventsRes.body.events)).toBe(true);
      expect(eventsRes.body.events.length).toBeGreaterThan(0);
    });
  });

  describe('Mentor Corner', () => {
    const createMentor = async (overrides = {}) => {
      const mentorUser = await createTestUser2({
        subscriptionPlan: 'free',
        subscriptionStatus: 'inactive',
      });
      await createTestDeviceSession(mentorUser._id);

      const profile = await MentorProfile.create({
        userId: mentorUser._id,
        headline: 'Wellness mentor',
        bio: 'Guides members on mindful living.',
        expertise: ['Meditation', 'Stress'],
        languages: ['English'],
        groupIds: [group._id],
        isVerified: true,
        isActive: true,
        ...overrides,
      });

      return { mentorUser, profile, mentorToken: generateUserToken(mentorUser._id) };
    };

    it('should list verified mentors only for accessible groups', async () => {
      const { mentorUser } = await createMentor();

      const unverified = await createTestUser({
        phone: '+919876543219',
        email: 'unverified.mentor@example.com',
        subscriptionPlan: 'free',
        subscriptionStatus: 'inactive',
      });
      await MentorProfile.create({
        userId: unverified._id,
        headline: 'Pending mentor',
        groupIds: [group._id],
        isVerified: false,
        isActive: true,
      });

      const res = await request(app)
        .get('/api/community/mentors')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.mentors.some((mentor) => mentor.userId === String(mentorUser._id))).toBe(true);
      expect(res.body.mentors.some((mentor) => mentor.userId === String(unverified._id))).toBe(false);
    });

    it('should return a mentor profile with shared groups and stats', async () => {
      const { mentorUser, profile } = await createMentor();

      const res = await request(app)
        .get(`/api/community/mentors/${mentorUser._id}`)
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.mentor.userId).toBe(String(mentorUser._id));
      expect(res.body.mentor.headline).toBe('Wellness mentor');
      expect(res.body.mentor.groups.some((mentorGroup) => mentorGroup._id === String(group._id))).toBe(true);
      expect(res.body.stats.questionsAssigned).toBe(0);
      expect(res.body.stats.answersGiven).toBe(0);
      expect(String(profile._id)).toBeTruthy();
    });

    it('should expose the mentor queue and mentor status', async () => {
      const { mentorUser, profile, mentorToken } = await createMentor();

      const question = await request(app)
        .post(`/api/community/groups/${group._id}/posts`)
        .set(getAuthHeader(token))
        .send({
          postType: 'question',
          title: 'How can I stay consistent?',
          content: 'I keep dropping my meditation habit.',
          assignedMentorId: profile._id,
        });

      expect(question.status).toBe(201);

      const me = await request(app)
        .get('/api/community/mentor/me')
        .set(getAuthHeader(mentorToken));
      expect(me.status).toBe(200);
      expect(me.body.isMentor).toBe(true);

      const queue = await request(app)
        .get('/api/community/mentor/questions')
        .set(getAuthHeader(mentorToken));
      expect(queue.status).toBe(200);
      expect(queue.body.questions.some((item) => item._id === question.body.post._id)).toBe(true);
      expect(queue.body.questions[0].viewerCanManageQuestion).toBe(true);
    });

    it('should let an assigned mentor accept an answer', async () => {
      const { mentorToken, profile } = await createMentor();

      const question = await request(app)
        .post(`/api/community/groups/${group._id}/posts`)
        .set(getAuthHeader(token))
        .send({
          postType: 'question',
          title: 'How do I handle anxiety?',
          content: 'Looking for a practical exercise.',
          assignedMentorId: profile._id,
        });

      const answerer = await createTestUser({
        phone: '+919876543218',
        email: 'answerer.mentor.corner@example.com',
        subscriptionPlan: 'pro',
        subscriptionStatus: 'active',
      });
      const answererToken = generateUserToken(answerer._id);

      const { GroupMember } = await import('../models/community.models.js');
      await GroupMember.create({
        groupId: group._id,
        userId: answerer._id,
        role: 'member',
        isActive: true,
      });

      const answer = await request(app)
        .post(`/api/community/posts/${question.body.post._id}/comments`)
        .set(getAuthHeader(answererToken))
        .send({ content: 'Try a five-minute grounding exercise.' });

      const accepted = await request(app)
        .patch(`/api/community/posts/${question.body.post._id}/accept-answer`)
        .set(getAuthHeader(mentorToken))
        .send({ commentId: answer.body.comment._id });

      expect(accepted.status).toBe(200);
      expect(accepted.body.isResolved).toBe(true);
    });

    it('should include mentor groups in my-groups without a plan', async () => {
      const { mentorUser, profile, mentorToken } = await createMentor();
      await assignMentorToGroup(mentorUser._id, group._id);

      const res = await request(app)
        .get('/api/community/my-groups')
        .set(getAuthHeader(mentorToken));

      expect(res.status).toBe(200);
      expect(res.body.mentorGroups.some((mentorGroup) => mentorGroup._id === String(group._id))).toBe(true);
      expect(String(profile._id)).toBeTruthy();
    });

    it('should let an admin create, update, and deactivate a mentor', async () => {
      const mentorUser = await createTestUser2({
        subscriptionPlan: 'free',
        subscriptionStatus: 'inactive',
      });

      const created = await request(app)
        .post('/api/community/admin/mentors')
        .set(getAdminApiKeyHeader())
        .send({
          userId: mentorUser._id,
          headline: 'Mindfulness mentor',
          bio: 'Ten years of practice.',
          expertise: ['Mindfulness'],
          languages: ['English', 'Hindi'],
          groupIds: [group._id],
          isVerified: true,
        });

      expect(created.status).toBe(201);
      expect(created.body.data.headline).toBe('Mindfulness mentor');
      expect(created.body.data.groupIds.some((mentorGroup) => String(mentorGroup._id) === String(group._id))).toBe(true);

      const { GroupMember } = await import('../models/community.models.js');
      const mentorMembership = await GroupMember.findOne({
        userId: mentorUser._id,
        groupId: group._id,
        role: 'mentor',
        isActive: true,
      });
      expect(mentorMembership).toBeTruthy();

      const updated = await request(app)
        .patch(`/api/community/admin/mentors/${created.body.data._id}`)
        .set(getAdminApiKeyHeader())
        .send({ headline: 'Senior mindfulness mentor', groupIds: [] });

      expect(updated.status).toBe(200);
      expect(updated.body.data.headline).toBe('Senior mindfulness mentor');

      const removedMembership = await GroupMember.findOne({
        userId: mentorUser._id,
        groupId: group._id,
        isActive: true,
      });
      expect(removedMembership).toBeFalsy();

      const deactivated = await request(app)
        .delete(`/api/community/admin/mentors/${created.body.data._id}`)
        .set(getAdminApiKeyHeader());

      expect(deactivated.status).toBe(200);
      expect(deactivated.body.data.isActive).toBe(false);
    });
  });

  describe('Community moderation', () => {
    it('should reject posting from a blocked user', async () => {
      user.communityPostingBlocked = true;
      await user.save();

      const res = await request(app)
        .post(`/api/community/groups/${group._id}/posts`)
        .set(getAuthHeader(token))
        .send({ content: 'Should be rejected.' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('POSTING_BLOCKED');
    });

    it('should let an admin block a user from posting', async () => {
      const res = await request(app)
        .post(`/api/community/admin/users/${user._id}/posting-block`)
        .set(getAdminApiKeyHeader())
        .send({ blocked: true });

      expect(res.status).toBe(200);
      expect(res.body.data.communityPostingBlocked).toBe(true);

      const { User } = await import('../models/user.models.js');
      const refreshed = await User.findById(user._id).lean();
      expect(refreshed.communityPostingBlocked).toBe(true);
    });

    it('should hide a blocked post from the user feed', async () => {
      const post = await Post.create({
        groupId: group._id,
        userId: user._id,
        content: 'Blocked content.',
        isBlocked: true,
      });

      const res = await request(app)
        .get('/api/community/feed')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.posts.some(p => p._id === String(post._id))).toBe(false);
    });

    it('should let an admin block a post', async () => {
      const post = await Post.create({
        groupId: group._id,
        userId: user._id,
        content: 'To be hidden.',
      });

      const res = await request(app)
        .patch(`/api/community/posts/${post._id}/block`)
        .set(getAdminApiKeyHeader())
        .send({ blocked: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isBlocked).toBe(true);
    });
  });
});
