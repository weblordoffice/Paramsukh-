import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRoutes from '../routes/index.js';
import adminRoutes from '../routes/admin/adminRoute.js';
import userRoutes from '../routes/user/userRoute.js';
import coursesRoutes from '../routes/courses/courseRoute.js';
import enrollmentRoutes from '../routes/enrollment/enrollmentRoute.js';
import eventsRoutes from '../routes/events/eventRoute.js';
import communityRoutes from '../routes/community/communityRoute.js';
import shopRoutes from '../routes/shop/shopRoute.js';
import productRoutes from '../routes/products/productsRoute.js';
import cartRoutes from '../routes/cart/cartRoute.js';
import wishlistRoutes from '../routes/wishlist/wishlistRoute.js';
import orderRoutes from '../routes/orders/ordersRoute.js';
import addressRoutes from '../routes/address/addressRoute.js';
import paymentRoutes from '../routes/payments/paymentsRoute.js';
import podcastRoutes from '../routes/podcast/podcastRoute.js';
import blogRoutes from '../routes/blog/blogRoute.js';
import donationsRoutes from '../routes/donations/donationsRoute.js';
import supportRoutes from '../routes/support/supportRoute.js';
import assessmentRoutes from '../routes/assessment/assessmentRoute.js';
import notificationsRoutes from '../routes/notifications/notificationsRoute.js';
import membershipPlanRoutes from '../routes/membership/membershipPlanRoute.js';
import configRoutes from '../routes/config/configRoute.js';
import adminCouponRoutes from '../routes/coupons/admin.coupons.routes.js';

const createTestApp = () => {
  const app = express();

  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  app.use('/api/auth', apiRoutes);
  app.use('/api/admin/coupons', adminCouponRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/courses', coursesRoutes);
  app.use('/api/enrollments', enrollmentRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/community', communityRoutes);
  app.use('/api/shops', shopRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/wishlist', wishlistRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/addresses', addressRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/podcasts', podcastRoutes);
  app.use('/api/blogs', blogRoutes);
  app.use('/api/donations', donationsRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/assessment', assessmentRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/membership-plans', membershipPlanRoutes);

  app.use((err, req, res, _next) => {
    console.error('Test app error:', err.message);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal Server Error',
    });
  });

  return app;
};

export default createTestApp;
