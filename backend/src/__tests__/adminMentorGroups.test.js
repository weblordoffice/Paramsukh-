import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { Group, GroupMember, MentorProfile } from '../models/community.models.js';
import { User } from '../models/user.models.js';
import {
  createTestAdmin,
  createTestUser,
  createTestDeviceSession,
  generateUserToken,
  generateAdminToken,
  getAuthHeader,
} from './helpers.js';

const app = createTestApp();
setupDB();

const unique = () => `${Date.now()}${Math.floor(Math.random() * 10000)}`;
let phoneCounter = 0;
const nextPhone = () => `+9197${String(++phoneCounter).padStart(8, '0')}`;

const createMentor = async () => {
  const mentor = await createTestUser({
    phone: nextPhone(),
    email: `mentor-${unique()}@test.com`,
    displayName: 'Mentor Owner',
    subscriptionPlan: 'silver',
    subscriptionStatus: 'active',
  });
  await createTestDeviceSession(mentor._id);
  const profile = await MentorProfile.create({
    userId: mentor._id,
    headline: 'Group owner',
    groupIds: [],
    isVerified: true,
    isActive: true,
  });
  return { mentor, profile, token: generateUserToken(mentor._id) };
};

const createCommunity = async () => Group.create({
  name: `Source Community ${unique()}`,
  description: 'Community for admin group tests',
  groupType: 'plan',
  planSlug: `source-${unique()}`,
  isActive: true,
});

const adminHeaders = (permissions = ['manage_mentor_groups'], email = `mentor-admin-${unique()}@test.com`) =>
  createTestAdmin({ email, permissions }).then((admin) => ({
    admin,
    headers: getAuthHeader(generateAdminToken(admin._id)),
  }));

describe('Admin mentor groups', () => {
  it('creates, edits, manages, and archives a mentor group', async () => {
    const { headers } = await adminHeaders();
    const { mentor, profile, token } = await createMentor();
    const community = await createCommunity();

    const directUser = await createTestUser({
      phone: nextPhone(),
      email: `direct-${unique()}@test.com`,
      displayName: 'Direct Member',
    });
    const communityUser = await createTestUser({
      phone: nextPhone(),
      email: `community-${unique()}@test.com`,
      displayName: 'Community Member',
    });
    await GroupMember.create({
      groupId: community._id,
      userId: communityUser._id,
      role: 'member',
      isActive: true,
    });

    const created = await request(app)
      .post('/api/community/admin/mentor-groups')
      .set(headers)
      .send({
        ownerUserId: String(mentor._id),
        name: 'Admin Created Circle',
        description: 'Created from the admin panel',
      });

    expect(created.status).toBe(201);
    expect(created.body.data.owner._id).toBe(String(mentor._id));
    const groupId = created.body.data._id;

    const list = await request(app)
      .get('/api/community/admin/mentor-groups')
      .set(headers);
    expect(list.status).toBe(200);
    expect(list.body.data.some((group) => group._id === groupId)).toBe(true);

    const updated = await request(app)
      .patch(`/api/community/admin/mentor-groups/${groupId}`)
      .set(headers)
      .send({ name: 'Renamed Admin Circle', description: 'Updated' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Renamed Admin Circle');

    const addDirect = await request(app)
      .post(`/api/community/admin/mentor-groups/${groupId}/members`)
      .set(headers)
      .send({ userIds: [String(directUser._id)] });
    expect(addDirect.status).toBe(200);

    const addCommunity = await request(app)
      .post(`/api/community/admin/mentor-groups/${groupId}/members`)
      .set(headers)
      .send({ groupIds: [String(community._id)] });
    expect(addCommunity.status).toBe(200);

    let inherited = await GroupMember.findOne({
      groupId,
      userId: communityUser._id,
      isActive: true,
    }).lean();
    expect(inherited).toBeTruthy();
    expect(String(inherited.sourceGroupId)).toBe(String(community._id));

    const detach = await request(app)
      .delete(`/api/community/admin/mentor-groups/${groupId}/linked-groups/${community._id}`)
      .set(headers);
    expect(detach.status).toBe(200);

    inherited = await GroupMember.findOne({
      groupId,
      userId: communityUser._id,
    }).lean();
    expect(inherited?.isActive).toBe(false);

    const directMembership = await GroupMember.findOne({
      groupId,
      userId: directUser._id,
      isActive: true,
    }).lean();
    expect(directMembership).toBeTruthy();

    const removeDirect = await request(app)
      .delete(`/api/community/admin/mentor-groups/${groupId}/members/${directUser._id}`)
      .set(headers);
    expect(removeDirect.status).toBe(200);

    const ownerRemoval = await request(app)
      .delete(`/api/community/admin/mentor-groups/${groupId}/members/${mentor._id}`)
      .set(headers);
    expect(ownerRemoval.status).toBe(400);

    const archive = await request(app)
      .delete(`/api/community/admin/mentor-groups/${groupId}`)
      .set(headers);
    expect(archive.status).toBe(200);

    const archived = await Group.findById(groupId).lean();
    expect(archived.isActive).toBe(false);
    const refreshedProfile = await MentorProfile.findById(profile._id).lean();
    expect(refreshedProfile.groupIds.map(String)).not.toContain(groupId);

    const mobileGroups = await request(app)
      .get('/api/community/my-groups')
      .set(getAuthHeader(token));
    expect(mobileGroups.status).toBe(200);
    expect((mobileGroups.body.groups || []).some((group) => group._id === groupId)).toBe(false);
  });

  it('requires the manage_mentor_groups permission', async () => {
    const { headers } = await adminHeaders(['manage_community'], `no-groups-${unique()}@test.com`);
    const res = await request(app)
      .get('/api/community/admin/mentor-groups')
      .set(headers);
    expect(res.status).toBe(403);
  });

  it('requires an active verified mentor as owner', async () => {
    const { headers } = await adminHeaders();
    const regular = await createTestUser({
      phone: nextPhone(),
      email: `regular-${unique()}@test.com`,
    });

    const res = await request(app)
      .post('/api/community/admin/mentor-groups')
      .set(headers)
      .send({ ownerUserId: String(regular._id), name: 'Invalid Owner Group' });

    expect(res.status).toBe(400);
  });

  it('lists active verified mentors for the owner selector', async () => {
    const { headers } = await adminHeaders();
    const { mentor } = await createMentor();

    const res = await request(app)
      .get('/api/community/admin/mentor-groups/mentors')
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data.some((entry) => entry._id === String(mentor._id))).toBe(true);
  });
});
