import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSMongoose from '@adminjs/mongoose';
// import uploadFeature from '@adminjs/upload';
// import { CloudinaryProvider } from '../lib/cloudinaryProvider.js';
import { User } from '../models/user.models.js';
import { Course, Video } from '../models/course.models.js';
import { Event } from '../models/event.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import Product from '../models/product.models.js';
import Shop from '../models/shop.models.js';
import Order from '../models/order.models.js';
import Booking from '../models/booking.models.js';
import Cart from '../models/cart.models.js';
import Address from '../models/address.models.js';
import Assessment from '../models/assessment.models.js';
import Notification from '../models/notification.models.js';
import { Post, Comment, GroupMember } from '../models/community.models.js';

// Register AdminJS adapter
AdminJS.registerAdapter({
  Resource: AdminJSMongoose.Resource,
  Database: AdminJSMongoose.Database,
});

// Admin authentication
const DEFAULT_ADMIN = {
  email: process.env.ADMIN_EMAIL || 'admin@paramsukh.com',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};

const authenticate = async (email, password) => {
  if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
    return Promise.resolve(DEFAULT_ADMIN);
  }
  return null;
};

// AdminJS configuration
export const setupAdmin = () => {
  // Upload features disabled - using custom Cloudinary API routes instead
  // const cloudinaryProvider = new CloudinaryProvider({
  //   bucket: process.env.CLOUDINARY_CLOUD_NAME,
  //   opts: {}
  // });

  const adminOptions = {
    resources: [
      {
        resource: User,
        options: {
          navigation: { name: 'User Management', icon: 'User' },
          properties: {
            password: { isVisible: false },
            phoneOTPAttempts: { isVisible: { list: false, edit: false, show: true } },
            payments: { isVisible: { list: false, edit: false, show: true } }
          },
          actions: {
            list: {
              before: async (request) => {
                return request;
              },
            },
          },
        },
      },
      {
        resource: Course,
        options: {
          navigation: { name: 'Courses', icon: 'Book' },
          properties: {
            // Hide complex arrays in list, show in edit
            videos: { isVisible: { list: false, edit: true, show: true } },
            pdfs: { isVisible: { list: false, edit: true, show: true } },
            liveSessions: { isVisible: { list: false, edit: true, show: true } },
            // Hide raw URL fields in edit, show upload instead? 
            // Better to show both or let adminjs handle view
            thumbnailUrl: { isVisible: { list: false, edit: true, show: true } },
            bannerUrl: { isVisible: { list: false, edit: true, show: true } }
          }
        },
        // Upload features disabled - using custom Cloudinary API routes instead
        // features: [
        //   uploadFeature({
        //     provider: cloudinaryProvider,
        //     properties: { key: 'thumbnailUrl', file: 'uploadThumbnail' },
        //     validation: { mimeTypes: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'] }
        //   }),
        //   uploadFeature({
        //     provider: cloudinaryProvider,
        //     properties: { key: 'bannerUrl', file: 'uploadBanner' },
        //     validation: { mimeTypes: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'] }
        //   })
        // ]
      },
      {
        resource: Video,
        options: {
          navigation: { name: 'Courses', icon: 'Monitor' },
          properties: {
            videoUrl: { isVisible: { list: true, edit: false, show: true } }, // URL is read-only in edit, set by upload
            thumbnailUrl: { isVisible: { list: false, edit: false, show: true } }
          }
        },
        // Upload features disabled - using custom Cloudinary API routes instead
        // features: [
        //   uploadFeature({
        //     provider: cloudinaryProvider,
        //     properties: { key: 'videoUrl', file: 'uploadVideo' },
        //     validation: { mimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'] }
        //   }),
        //   uploadFeature({
        //     provider: cloudinaryProvider,
        //     properties: { key: 'thumbnailUrl', file: 'uploadThumbnail' },
        //     validation: { mimeTypes: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'] }
        //   })
        // ]
      },
      {
        resource: Enrollment,
        options: {
          navigation: { name: 'Courses', icon: 'Book' },
        },
      },
      {
        resource: Event,
        options: {
          navigation: { name: 'Events', icon: 'Calendar' },
          properties: {
            images: { isVisible: { list: false, edit: true, show: true } },
            videos: { isVisible: { list: false, edit: true, show: true } },
            reminderSent: { isVisible: false },
            reminderSentAt: { isVisible: false },
            currentAttendees: { isVisible: { list: true, edit: false, show: true } }
          }
        },
      },
      {
        resource: Shop,
        options: {
          navigation: { name: 'Marketplace', icon: 'ShoppingCart' },
        },
      },
      {
        resource: Product,
        options: {
          navigation: { name: 'Marketplace', icon: 'ShoppingCart' },
          properties: {
            images: { isVisible: { list: false, edit: true, show: true } },
            variants: { isVisible: { list: false, edit: true, show: true } }
          }
        },
      },
      {
        resource: Order,
        options: {
          navigation: { name: 'Marketplace', icon: 'ShoppingCart' },
        },
      },
      {
        resource: Cart,
        options: {
          navigation: { name: 'Marketplace', icon: 'ShoppingCart' },
        },
      },
      {
        resource: Booking,
        options: {
          navigation: { name: 'Counseling', icon: 'Calendar' },
        },
      },
      {
        resource: Assessment,
        options: {
          navigation: { name: 'User Management', icon: 'User' },
        },
      },
      {
        resource: Address,
        options: {
          navigation: { name: 'User Management', icon: 'User' },
        },
      },
      {
        resource: Notification,
        options: {
          navigation: { name: 'Communications', icon: 'Bell' },
        },
      },
      {
        resource: Post,
        options: {
          navigation: { name: 'Community', icon: 'Users' },
        },
      },
      {
        resource: Comment,
        options: {
          navigation: { name: 'Community', icon: 'Users' },
        },
      },
      {
        resource: GroupMember,
        options: {
          navigation: { name: 'Community', icon: 'Users' },
        },
      },
    ],
    branding: {
      companyName: 'ParamSukh Admin',
      logo: false,
      withMadeWithLove: false,
      favicon: 'https://res.cloudinary.com/demo/image/upload/v1/favicon.ico',
    },
    rootPath: '/admin',
    dashboard: {
      component: false,
    },
  };

  const admin = new AdminJS(adminOptions);

  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookieName: 'adminjs',
      cookiePassword: process.env.ADMIN_COOKIE_PASSWORD || 'sessionsecret',
    },
    null,
    {
      resave: true,
      saveUninitialized: true,
      secret: process.env.ADMIN_SESSION_SECRET || 'sessionsecret',
    }
  );

  return { admin, adminRouter };
};
