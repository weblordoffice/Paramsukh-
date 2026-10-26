import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { Group, Post } from '../models/community.models.js';
import { Event } from '../models/event.models.js';
import {
  createTestAdmin,
  createTestSuperAdmin,
  createTestCourse,
  generateAdminToken,
  getAuthHeader,
} from './helpers.js';

const app = createTestApp();
setupDB();

const unique = () => `${Date.now()}${Math.floor(Math.random() * 10000)}`;

const createAdminWithScope = async (permission, ids) => {
  const admin = await createTestAdmin({
    email: `scope-admin-${unique()}@test.com`,
    permissions: [permission],
    permissionScopes: {
      [permission]: { mode: 'selected', ids },
    },
  });
  return { admin, headers: getAuthHeader(generateAdminToken(admin._id)) };
};

const createEvent = async (title, startTime) => Event.create({
  title,
  description: `${title} description`,
  eventDate: startTime,
  eventTime: '10:00 AM',
  startTime,
  location: 'Online',
  locationType: 'online',
  category: 'wellness',
  isActive: true,
});

describe('Admin resource permission scopes', () => {
  it('stores and returns permission scopes when creating an admin', async () => {
    const superAdmin = await createTestSuperAdmin();
    const course = await createTestCourse({
      title: 'Scoped Course',
      slug: `scoped-course-${unique()}`,
    });
    const headers = getAuthHeader(generateAdminToken(superAdmin._id));

    const created = await request(app)
      .post('/api/admin/users')
      .set(headers)
      .send({
        name: 'Scoped Admin',
        email: `scoped-${unique()}@test.com`,
        role: 'admin',
        permissions: ['manage_courses'],
        permissionScopes: {
          manage_courses: { mode: 'selected', ids: [String(course._id)] },
        },
      });

    expect(created.status).toBe(201);
    expect(created.body.admin.permissionScopes.manage_courses.mode).toBe('selected');
    expect(created.body.admin.permissionScopes.manage_courses.ids.map(String)).toEqual([String(course._id)]);

    const list = await request(app).get('/api/admin/users').set(headers);
    const saved = list.body.admins.find((admin) => admin.email === created.body.admin.email);
    expect(saved.permissionScopes.manage_courses.mode).toBe('selected');

    const updated = await request(app)
      .put(`/api/admin/users/${created.body.admin._id}`)
      .set(headers)
      .send({
        permissions: ['manage_courses'],
        permissionScopes: {
          manage_courses: { mode: 'all', ids: [] },
        },
      });

    expect(updated.status).toBe(200);
    expect(updated.body.admin.permissionScopes.manage_courses.mode).toBe('all');

    const afterUpdate = await request(app).get('/api/admin/users').set(headers);
    const updatedSaved = afterUpdate.body.admins.find((admin) => admin._id === created.body.admin._id);
    expect(updatedSaved.permissionScopes.manage_courses.mode).toBe('all');
  });

  it('limits course listing, detail, editing, and creation for a selected scope', async () => {
    const selectedCourse = await createTestCourse({
      title: 'Selected Course',
      slug: `selected-course-${unique()}`,
    });
    const otherCourse = await createTestCourse({
      title: 'Other Course',
      slug: `other-course-${unique()}`,
    });
    const { headers } = await createAdminWithScope('manage_courses', [selectedCourse._id]);

    const list = await request(app).get('/api/courses/all?limit=100').set(headers);
    expect(list.status).toBe(200);
    expect(list.body.courses.map((course) => String(course._id))).toEqual([String(selectedCourse._id)]);

    const otherDetail = await request(app).get(`/api/courses/${otherCourse._id}`).set(headers);
    expect(otherDetail.status).toBe(403);

    const otherUpdate = await request(app)
      .put(`/api/courses/update/${otherCourse._id}`)
      .set(headers)
      .send({ title: 'Blocked update' });
    expect(otherUpdate.status).toBe(403);

    const create = await request(app)
      .post('/api/courses/create')
      .set(headers)
      .send({});
    expect(create.status).toBe(403);
  });

  it('limits event listing and mutations for a selected scope', async () => {
    const selectedEvent = await createEvent('Selected Event', new Date(Date.now() + 86400000));
    const otherEvent = await createEvent('Other Event', new Date(Date.now() + 172800000));
    const { headers } = await createAdminWithScope('manage_events', [selectedEvent._id]);

    const list = await request(app)
      .get('/api/events/all?includeCancelled=true&limit=100')
      .set(headers);
    expect(list.status).toBe(200);
    expect(list.body.events.map((event) => String(event._id))).toEqual([String(selectedEvent._id)]);

    const cancelOther = await request(app)
      .patch(`/api/events/${otherEvent._id}/cancel`)
      .set(headers)
      .send({});
    expect(cancelOther.status).toBe(403);

    const create = await request(app)
      .post('/api/events/create')
      .set(headers)
      .send({});
    expect(create.status).toBe(403);
  });

  it('limits community posts, groups, and moderation to selected communities', async () => {
    const selectedGroup = await Group.create({
      name: `Selected Community ${unique()}`,
      groupType: 'category',
      category: 'wellness',
      isActive: true,
    });
    const otherGroup = await Group.create({
      name: `Other Community ${unique()}`,
      groupType: 'category',
      category: 'wellness',
      isActive: true,
    });
    const selectedPost = await Post.create({
      groupId: selectedGroup._id,
      content: 'Selected post',
      isActive: true,
    });
    const otherPost = await Post.create({
      groupId: otherGroup._id,
      content: 'Other post',
      isActive: true,
    });
    const { headers } = await createAdminWithScope('manage_community', [selectedGroup._id]);

    const posts = await request(app).get('/api/community/all?limit=100').set(headers);
    expect(posts.status).toBe(200);
    expect(posts.body.data.posts.map((post) => String(post._id))).toEqual([String(selectedPost._id)]);

    const groups = await request(app).get('/api/community/admin/groups').set(headers);
    expect(groups.status).toBe(200);
    expect(groups.body.data.map((group) => String(group._id))).toEqual([String(selectedGroup._id)]);

    const deleteOther = await request(app)
      .delete(`/api/community/posts/${otherPost._id}/admin`)
      .set(headers);
    expect(deleteOther.status).toBe(403);

    const createInOther = await request(app)
      .post('/api/community/admin/posts')
      .set(headers)
      .send({ content: 'Blocked post', groupIds: [String(otherGroup._id)] });
    expect(createInOther.status).toBe(403);
  });

  it('limits mentor groups to the selected scope', async () => {
    const selectedGroup = await Group.create({
      name: `Selected Mentor Group ${unique()}`,
      groupType: 'mentor',
      isActive: true,
    });
    const otherGroup = await Group.create({
      name: `Other Mentor Group ${unique()}`,
      groupType: 'mentor',
      isActive: true,
    });
    const { headers } = await createAdminWithScope('manage_mentor_groups', [selectedGroup._id]);

    const list = await request(app).get('/api/community/admin/mentor-groups').set(headers);
    expect(list.status).toBe(200);
    expect(list.body.data.map((group) => String(group._id))).toEqual([String(selectedGroup._id)]);

    const updateOther = await request(app)
      .patch(`/api/community/admin/mentor-groups/${otherGroup._id}`)
      .set(headers)
      .send({ name: 'Blocked rename' });
    expect(updateOther.status).toBe(403);

    const create = await request(app)
      .post('/api/community/admin/mentor-groups')
      .set(headers)
      .send({ name: 'Blocked group' });
    expect(create.status).toBe(403);
  });

  it('keeps admins with no scope unrestricted', async () => {
    const courseA = await createTestCourse({
      title: 'Unrestricted A',
      slug: `unrestricted-a-${unique()}`,
    });
    const courseB = await createTestCourse({
      title: 'Unrestricted B',
      slug: `unrestricted-b-${unique()}`,
    });
    const admin = await createTestAdmin({
      email: `unrestricted-${unique()}@test.com`,
      permissions: ['manage_courses'],
    });
    const headers = getAuthHeader(generateAdminToken(admin._id));

    const list = await request(app).get('/api/courses/all?limit=100').set(headers);
    const ids = list.body.courses.map((course) => String(course._id));
    expect(ids).toEqual(expect.arrayContaining([String(courseA._id), String(courseB._id)]));
  });
});
