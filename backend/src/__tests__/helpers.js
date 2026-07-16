import jwt from 'jsonwebtoken';
import { User } from '../models/user.models.js';
import Admin from '../models/admin.models.js';
import { Course } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { DeviceSession } from '../models/deviceSession.models.js';

export const TEST_PHONE = '9876543210';
export const TEST_PHONE_2 = '9876543211';
export const TEST_OTP = '123456';
export const TEST_EMAIL = 'test@example.com';
export const TEST_NAME = 'Test User';

export const createTestUser = async (overrides = {}) => {
  const uniqueId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const user = await User.create({
    phone: `+91${TEST_PHONE}`,
    displayName: TEST_NAME,
    email: overrides.email || `test${uniqueId}@example.com`,
    authProvider: 'phone',
    subscriptionPlan: 'free',
    subscriptionStatus: 'inactive',
    loginCount: 1,
    ...overrides,
  });
  // Ensure device session exists so protectedRoutes passes
  await createTestDeviceSession(user._id);
  return user;
};

export const createTestUser2 = async (overrides = {}) => {
  const uniqueId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const user = await User.create({
    phone: `+91${TEST_PHONE_2}`,
    displayName: 'Second User',
    email: overrides.email || `second${uniqueId}@example.com`,
    authProvider: 'phone',
    subscriptionPlan: 'free',
    subscriptionStatus: 'inactive',
    loginCount: 1,
    ...overrides,
  });
  return user;
};

export const generateUserToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15d' });
};

export const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

export const createTestDeviceSession = async (userId, deviceId = 'test-device-id') => {
  return DeviceSession.create({
    user: userId,
    deviceId,
    deviceName: 'Test Device',
    os: 'Test OS',
    browser: 'Test Browser',
    authProvider: 'phone',
    lastSeen: new Date(),
    isRevoked: false,
  });
};

export const createTestAdmin = async (overrides = {}) => {
  const admin = await Admin.create({
    name: 'Test Admin',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin',
    isActive: true,
    permissions: ['manage_users', 'manage_courses'],
    ...overrides,
  });
  return admin;
};

export const createTestSuperAdmin = async (overrides = {}) => {
  const admin = await Admin.create({
    name: 'Super Admin',
    email: 'superadmin@example.com',
    password: 'password123',
    role: 'super_admin',
    isActive: true,
    ...overrides,
  });
  return admin;
};

export const generateAdminToken = (adminId) => {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  return jwt.sign({ id: adminId, role: 'admin' }, secret, {
    expiresIn: '24h',
  });
};

export const getAuthHeader = (token) => ({
  Authorization: `Bearer ${token}`,
  'x-device-id': 'test-device-id'
});

export const getAdminApiKeyHeader = () => ({
  'X-Admin-API-Key': process.env.ADMIN_API_KEY,
});

export const getAdminAuthHeader = (token) => ({
  Authorization: `Bearer ${token}`,
  'X-Admin-API-Key': process.env.ADMIN_API_KEY,
});

export const createTestCourse = async (overrides = {}) => {
  const course = await Course.create({
    title: 'Test Course',
    description: 'A test course for automated testing purposes.',
    slug: `test-course-${Date.now()}`,
    category: 'yoga',
    duration: '4 weeks',
    status: 'published',
    videos: [
      {
        title: 'Introduction',
        description: 'Introduction video',
        duration: '10:00',
        videoUrl: 'https://example.com/video1.mp4',
        order: 0,
        isFree: false,
      },
      {
        title: 'Chapter 1',
        description: 'First chapter',
        duration: '15:00',
        videoUrl: 'https://example.com/video2.mp4',
        order: 1,
        isFree: false,
      },
    ],
    pdfs: [
      {
        title: 'PDF Guide',
        description: 'Course PDF',
        pdfUrl: 'https://example.com/guide.pdf',
        order: 0,
        fileSize: '2.5 MB',
      },
    ],
    ...overrides,
  });
  return course;
};

export const createTestEnrollment = async (userId, courseId, overrides = {}) => {
  const enrollment = await Enrollment.create({
    userId,
    courseId,
    ...overrides,
  });
  return enrollment;
};
