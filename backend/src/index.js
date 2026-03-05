import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDatabase from './config/database.js';
import apiRoutes from './routes/index.js';
import coursesRoutes from './routes/courses/courseRoute.js';
import eventsRoutes from './routes/events/eventRoute.js';
import enrollmentRoutes from './routes/enrollment/enrollmentRoute.js';
import userRoutes from './routes/user/userRoute.js';
import communityRoutes from './routes/community/communityRoute.js';
import assessmentRoutes from './routes/assessment/assessmentRoute.js';
import notificationsRoutes from './routes/notifications/notificationsRoute.js';
import counselingRoutes from './routes/counseling/counselingRoute.js';
import shopRoutes from './routes/shop/shopRoute.js';
import productRoutes from './routes/products/productsRoute.js';
import cartRoutes from './routes/cart/cartRoute.js';
import wishlistRoutes from './routes/wishlist/wishlistRoute.js';
import orderRoutes from './routes/orders/ordersRoute.js';
import addressRoutes from './routes/address/addressRoute.js';
import paymentRoutes from './routes/payments/paymentsRoute.js';
import uploadRoutes from './routes/upload/uploadRoute.js';
import podcastRoutes from './routes/podcast/podcastRoute.js';
import adminRoutes from './routes/admin/adminRoute.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = [
  'https://getbill.in',
  'https://www.getbill.in',
  // local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // allow non-browser clients (curl, server-to-server) with no Origin header
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
// path-to-regexp v8+ requires a named wildcard (e.g. /*splat), not '*' or '(.*)'
app.options('/*splat', cors(corsOptions));
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));
app.use(cookieParser());

// Routes
app.use('/api/auth', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/counseling', counselingRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/podcasts', podcastRoutes);

// Health check (for testing if API is reachable)
app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'API is running', timestamp: new Date().toISOString() });
});

// Test route
app.get('/', (req, res) => {
  res.json({
    message: '🚀 ParamSukh API v2.0',
    version: '2.0.0',
    endpoints: {
      auth: {
        sendOTP: 'POST /api/auth/send-otp',
        verifyOTP: 'POST /api/auth/verify-otp',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me'
      },
      courses: {
        create: 'POST /api/courses/create',
        getAll: 'GET /api/courses/all',
        getById: 'GET /api/courses/:id',
        update: 'PUT /api/courses/update/:id',
        delete: 'DELETE /api/courses/delete/:id',
        videos: 'CRUD /api/courses/:courseId/videos',
        pdfs: 'CRUD /api/courses/:courseId/pdfs',
        liveSessions: 'CRUD /api/courses/:courseId/livesessions'
      },
      events: {
        create: 'POST /api/events/create',
        getAll: 'GET /api/events/all',
        getById: 'GET /api/events/:id',
        register: 'POST /api/events/:eventId/register',
        myRegistrations: 'GET /api/events/my-registrations'
      },
      enrollments: {
        enroll: 'POST /api/enrollments/enroll',
        myCourses: 'GET /api/enrollments/my-courses',
        continueLearning: 'GET /api/enrollments/continue-learning',
        progress: 'GET /api/enrollments/course/:courseId/progress',
        markVideoComplete: 'POST /api/enrollments/course/:courseId/video/:videoId/complete'
      },
      user: {
        profile: 'GET/PUT /api/user/profile',
        photo: 'PUT/DELETE /api/user/profile/photo',
        preferences: 'PUT /api/user/preferences',
        subscription: 'GET /api/user/subscription',
        membershipPurchase: 'POST /api/user/membership/purchase',
        stats: 'GET /api/user/stats'
      },
      community: {
        checkAccess: 'GET /api/community/check-access',
        myGroups: 'GET /api/community/my-groups',
        groupPosts: 'GET /api/community/groups/:groupId/posts',
        createPost: 'POST /api/community/groups/:groupId/posts',
        likePost: 'POST /api/community/posts/:postId/like',
        deletePost: 'DELETE /api/community/posts/:postId',
        comments: 'GET/POST /api/community/posts/:postId/comments',
        likeComment: 'POST /api/community/comments/:commentId/like'
      },
      assessment: {
        submit: 'POST /api/assessment/submit',
        get: 'GET /api/assessment',
        recommendations: 'GET /api/assessment/recommendations',
        status: 'GET /api/assessment/status',
        delete: 'DELETE /api/assessment'
      },
      notifications: {
        getAll: 'GET /api/notifications',
        unreadCount: 'GET /api/notifications/unread-count',
        markAsRead: 'PATCH /api/notifications/:id/read',
        markAllAsRead: 'PATCH /api/notifications/read-all',
        delete: 'DELETE /api/notifications/:id',
        deleteAll: 'DELETE /api/notifications/all'
      },
      counseling: {
        availability: 'GET /api/counseling/availability',
        book: 'POST /api/counseling/book',
        myBookings: 'GET /api/counseling/my-bookings',
        details: 'GET /api/counseling/:bookingId',
        cancel: 'PATCH /api/counseling/:bookingId/cancel',
        reschedule: 'PATCH /api/counseling/:bookingId/reschedule',
        payment: 'POST /api/counseling/:bookingId/payment',
        feedback: 'POST /api/counseling/:bookingId/feedback'
      },
      marketplace: {
        shops: {
          getAll: 'GET /api/shops',
          getById: 'GET /api/shops/:id',
          register: 'POST /api/shops/register',
          update: 'PUT /api/shops/:id',
          products: 'GET /api/shops/:id/products',
          reviews: 'GET /api/shops/:id/reviews'
        },
        products: {
          getAll: 'GET /api/products',
          getById: 'GET /api/products/:id',
          search: 'GET /api/products/search',
          featured: 'GET /api/products/featured',
          category: 'GET /api/products/category/:categoryId',
          create: 'POST /api/products/create',
          update: 'PUT /api/products/:id',
          delete: 'DELETE /api/products/:id',
          addReview: 'POST /api/products/:id/review',
          getReviews: 'GET /api/products/:id/reviews'
        },
        cart: {
          get: 'GET /api/cart',
          add: 'POST /api/cart/add',
          update: 'PATCH /api/cart/update/:itemId',
          remove: 'DELETE /api/cart/remove/:itemId',
          clear: 'DELETE /api/cart/clear',
          applyCoupon: 'POST /api/cart/apply-coupon'
        },
        wishlist: {
          get: 'GET /api/wishlist',
          add: 'POST /api/wishlist/add',
          remove: 'DELETE /api/wishlist/remove/:productId',
          moveToCart: 'POST /api/wishlist/move-to-cart/:productId',
          clear: 'DELETE /api/wishlist/clear'
        },
        orders: {
          create: 'POST /api/orders/create',
          myOrders: 'GET /api/orders/my-orders',
          details: 'GET /api/orders/:id',
          cancel: 'PATCH /api/orders/:id/cancel',
          return: 'POST /api/orders/:id/return',
          track: 'GET /api/orders/:id/track',
          invoice: 'GET /api/orders/:id/invoice'
        },
        addresses: {
          getAll: 'GET /api/addresses',
          add: 'POST /api/addresses/add',
          update: 'PUT /api/addresses/:id',
          delete: 'DELETE /api/addresses/:id',
          setDefault: 'PATCH /api/addresses/:id/default'
        }
      }
    },
    features: [
      'Phone OTP Authentication',
      'Course Management with Videos/PDFs/Live Sessions',
      'Event Registration System',
      'Course Enrollment & Progress Tracking',
      'User Profile Management',
      'Subscription Plans',
      'Community Groups & Social Features',
      'User Assessment & Personalized Recommendations',
      'Real-time Notifications System',
      'Counseling Booking & Management',
      'Complete Marketplace System',
      'Shop & Product Management',
      'Shopping Cart & Wishlist',
      'Order Management & Tracking',
      'Multiple Delivery Addresses'
    ]
  });
});

// Connect to database first so login and other routes don't hang waiting for MongoDB
await connectDatabase();

// Listen on all interfaces (0.0.0.0) so phone/other devices on LAN can reach the API
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
  console.log(`   → Use in browser: http://127.0.0.1:${PORT}/health`);
  console.log(`   → On this network: http://192.168.0.104:${PORT}`);
});