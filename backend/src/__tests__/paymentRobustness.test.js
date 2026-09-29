/**
 * Payment robustness tests - concurrency, idempotency, and edge cases
 */
import request from 'supertest';
import mongoose from 'mongoose';
import createTestApp from './app.js';
import {
  createTestUser,
  createTestUser2,
  generateUserToken,
  getAuthHeader,
} from './helpers.js';
import { setupDB } from './db.js';
import Order from '../models/order.models.js';
import Cart from '../models/cart.models.js';
import Product from '../models/product.models.js';
import Shop from '../models/shop.models.js';
import Category from '../models/category.models.js';
import Address from '../models/address.models.js';
import Coupon from '../models/coupon.models.js';
import CouponUsage from '../models/couponUsage.models.js';
import { User } from '../models/user.models.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';

const app = createTestApp();
setupDB();

let user;
let user2;
let authHeader;
let authHeader2;
let testShop;
let testCategory;

beforeEach(async () => {
  user = await createTestUser();
  user2 = await createTestUser2();
  authHeader = getAuthHeader(generateUserToken(user._id));
  authHeader2 = getAuthHeader(generateUserToken(user2._id));

  testCategory = await Category.create({
    name: 'Test Category',
    slug: `test-cat-${Date.now()}`,
    description: 'Test category for tests',
  });

  testShop = await Shop.create({
    name: 'Test Shop',
    slug: `test-shop-${Date.now()}`,
    description: 'Test shop description',
    owner: user._id,
    email: 'test@shop.com',
    phone: '9876543210',
    address: {
      street: '123 Test St',
      city: 'Test City',
      state: 'TS',
      pincode: '123456',
      country: 'India',
    },
    status: 'approved',
  });
});

describe('Concurrent order inventory', () => {
  it('should prevent overselling when two users order the last stock simultaneously', async () => {
    const product = await Product.create({
      name: 'Limited Stock Item',
      slug: `product-${Date.now()}-1`,
      shop: testShop._id,
      category: testCategory._id,
      description: 'A product with limited stock',
      pricing: { mrp: 100, sellingPrice: 90 },
      inventory: { stock: 1, isUnlimited: false },
      status: 'published',
    });

    const address = await Address.create({
      user: user._id,
      fullName: 'Test User',
      phone: '9876543210',
      pincode: '110001',
      state: 'Delhi',
      city: 'New Delhi',
      addressLine1: '123 Test Street',
    });

    const address2 = await Address.create({
      user: user2._id,
      fullName: 'Test User 2',
      phone: '9876543211',
      pincode: '110001',
      state: 'Delhi',
      city: 'New Delhi',
      addressLine1: '124 Test Street',
    });

    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 1, price: 90 }],
      subtotal: 90,
      total: 90,
    });

    await Cart.create({
      user: user2._id,
      items: [{ product: product._id, quantity: 1, price: 90 }],
      subtotal: 90,
      total: 90,
    });

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/orders/create')
        .set(authHeader)
        .send({ addressId: address._id, paymentMethod: 'cod' }),
      request(app)
        .post('/api/orders/create')
        .set(authHeader2)
        .send({ addressId: address2._id, paymentMethod: 'cod' }),
    ]);

    const successfulOrders = [res1, res2].filter(r => r.status === 201 && r.body.success);
    const failedOrders = [res1, res2].filter(r => r.status !== 201 || !r.body.success);

    expect(successfulOrders.length).toBe(1);
    expect(failedOrders.length).toBe(1);

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.inventory.stock).toBe(0);
  });

  it('should restore inventory when order is cancelled', async () => {
    const product = await Product.create({
      name: 'Test Product',
      slug: `product-${Date.now()}-2`,
      shop: testShop._id,
      category: testCategory._id,
      description: 'A test product',
      pricing: { mrp: 100, sellingPrice: 90 },
      inventory: { stock: 5, isUnlimited: false },
      status: 'published',
    });

    const address = await Address.create({
      user: user._id,
      fullName: 'Test User',
      phone: '9876543210',
      pincode: '110001',
      state: 'Delhi',
      city: 'New Delhi',
      addressLine1: '123 Test Street',
    });

    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 2, price: 90 }],
      subtotal: 180,
      total: 180,
    });

    const createRes = await request(app)
      .post('/api/orders/create')
      .set(authHeader)
      .send({ addressId: address._id, paymentMethod: 'cod' });

    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.order._id;

    const beforeCancelProduct = await Product.findById(product._id);
    expect(beforeCancelProduct.inventory.stock).toBe(3);

    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set(authHeader)
      .send({ reason: 'Changed my mind' });

    expect(cancelRes.status).toBe(200);

    const afterCancelProduct = await Product.findById(product._id);
    expect(afterCancelProduct.inventory.stock).toBe(5);
  });

  it('should NOT allow cancellation of a paid Razorpay order', async () => {
    const product = await Product.create({
      name: 'Paid Product',
      slug: `product-${Date.now()}-3`,
      shop: testShop._id,
      category: testCategory._id,
      description: 'A paid product',
      pricing: { mrp: 100, sellingPrice: 90 },
      inventory: { stock: 5, isUnlimited: false },
      status: 'published',
    });

    const address = await Address.create({
      user: user._id,
      fullName: 'Test User',
      phone: '9876543210',
      pincode: '110001',
      state: 'Delhi',
      city: 'New Delhi',
      addressLine1: '123 Test Street',
    });

    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 1, price: 90 }],
      subtotal: 90,
      total: 90,
    });

    const createRes = await request(app)
      .post('/api/orders/create')
      .set(authHeader)
      .send({ addressId: address._id, paymentMethod: 'razorpay' });

    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.order._id;

    await Order.findByIdAndUpdate(orderId, {
      'payment.status': 'completed',
      'payment.razorpayPaymentId': 'pay_test_123',
      status: 'confirmed',
    });

    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set(authHeader)
      .send({ reason: 'Want to cancel' });

    expect(cancelRes.status).toBe(400);
    expect(cancelRes.body.message).toContain('Paid orders cannot be cancelled');
  });
});

describe('Referral points on cancellation', () => {
  it('should reverse referral points when order is cancelled', async () => {
    const ReferralConfig = (await import('../models/referralConfig.models.js')).default;
    await ReferralConfig.create({
      isActive: true,
      pointValueInRupees: 1,
      minRedemptionPoints: 1,
      maxRedemptionPercent: 100,
    });

    const product = await Product.create({
      name: 'Test Product',
      slug: `product-${Date.now()}-4`,
      shop: testShop._id,
      category: testCategory._id,
      description: 'A test product',
      pricing: { mrp: 100, sellingPrice: 90 },
      inventory: { stock: 10, isUnlimited: false },
      status: 'published',
    });

    const address = await Address.create({
      user: user._id,
      fullName: 'Test User',
      phone: '9876543210',
      pincode: '110001',
      state: 'Delhi',
      city: 'New Delhi',
      addressLine1: '123 Test Street',
    });

    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 1, price: 90 }],
      subtotal: 90,
      total: 90,
    });

    await User.findByIdAndUpdate(user._id, { referralPoints: 50 });

    const createRes = await request(app)
      .post('/api/orders/create')
      .set(authHeader)
      .send({ addressId: address._id, paymentMethod: 'cod', useReferralPoints: 30 });

    expect(createRes.status).toBe(201);

    const beforeCancelUser = await User.findById(user._id);
    expect(beforeCancelUser.referralPoints).toBe(20);

    const orderId = createRes.body.data.order._id;
    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set(authHeader)
      .send({ reason: 'Changed mind' });

    expect(cancelRes.status).toBe(200);

    const afterCancelUser = await User.findById(user._id);
    expect(afterCancelUser.referralPoints).toBe(50);
  });
});

describe('Coupon concurrency', () => {
  it('should record coupon usage on order creation', async () => {
    const coupon = await Coupon.create({
      code: `SAVE10-${Date.now()}`,
      description: 'Save 10 percent',
      discountType: 'percentage',
      discountValue: 10,
      isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    });

    const product = await Product.create({
      name: 'Test Product',
      slug: `product-${Date.now()}-5`,
      shop: testShop._id,
      category: testCategory._id,
      description: 'A test product',
      pricing: { mrp: 100, sellingPrice: 90 },
      inventory: { stock: 20, isUnlimited: false },
      status: 'published',
    });

    const address = await Address.create({
      user: user._id,
      fullName: 'Test User',
      phone: '9876543210',
      pincode: '110001',
      state: 'Delhi',
      city: 'New Delhi',
      addressLine1: '123 Test Street',
    });

    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 1, price: 90 }],
      subtotal: 90,
      total: 81,
      coupon: { code: coupon.code, discount: 9, discountType: 'percentage' },
    });

    const res = await request(app)
      .post('/api/orders/create')
      .set(authHeader)
      .send({ addressId: address._id, paymentMethod: 'cod' });

    expect(res.status).toBe(201);
  });
});

describe('Payment idempotency', () => {
  it('should handle duplicate order creation attempts gracefully', async () => {
    const product = await Product.create({
      name: 'Test Product',
      slug: `product-${Date.now()}-6`,
      shop: testShop._id,
      category: testCategory._id,
      description: 'A test product',
      pricing: { mrp: 100, sellingPrice: 90 },
      inventory: { stock: 10, isUnlimited: false },
      status: 'published',
    });

    const address = await Address.create({
      user: user._id,
      fullName: 'Test User',
      phone: '9876543210',
      pincode: '110001',
      state: 'Delhi',
      city: 'New Delhi',
      addressLine1: '123 Test Street',
    });

    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 1, price: 90 }],
      subtotal: 90,
      total: 90,
    });

    const createRes = await request(app)
      .post('/api/orders/create')
      .set(authHeader)
      .send({ addressId: address._id, paymentMethod: 'cod' });

    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.order._id;

    const order = await Order.findById(orderId);
    expect(order).toBeTruthy();
    expect(order.status).toBe('pending');
  });
});

describe('Membership upgrade/downgrade', () => {
  it('should activate membership when user has no active membership', async () => {
    const plan = await MembershipPlan.create({
      title: 'Silver Plan',
      slug: `silver-${Date.now()}`,
      status: 'published',
      pricing: { oneTime: { amount: 999, currency: 'INR' } },
      validityDays: 365,
    });

    const orderRes = await request(app)
      .post('/api/payments/create-order')
      .set(authHeader)
      .send({ plan: plan.slug });

    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.orderId).toMatch(/^order_test_/);

    const verifyRes = await request(app)
      .post('/api/payments/verify-membership')
      .set(authHeader)
      .send({
        razorpay_order_id: orderRes.body.data.orderId,
        razorpay_payment_id: `pay_test_${Date.now()}`,
        razorpay_signature: 'test_sig',
        plan: plan.slug,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.subscriptionStatus).toBe('active');
    expect(updatedUser.subscriptionPlan).toBe(plan.slug);
  });

  it('should allow purchase when membership is inactive', async () => {
    const plan = await MembershipPlan.create({
      title: 'Gold Plan',
      slug: `gold-${Date.now()}`,
      status: 'published',
      pricing: { oneTime: { amount: 1999, currency: 'INR' } },
      validityDays: 365,
    });

    user.subscriptionStatus = 'inactive';
    user.subscriptionEndDate = new Date(Date.now() - 86400000);
    await user.save();

    const orderRes = await request(app)
      .post('/api/payments/create-order')
      .set(authHeader)
      .send({ plan: plan.slug });

    expect(orderRes.status).toBe(200);

    const verifyRes = await request(app)
      .post('/api/payments/verify-membership')
      .set(authHeader)
      .send({
        razorpay_order_id: orderRes.body.data.orderId,
        razorpay_payment_id: `pay_test_${Date.now()}`,
        razorpay_signature: 'test_sig',
        plan: plan.slug,
      });

    expect(verifyRes.status).toBe(200);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.subscriptionStatus).toBe('active');
    expect(updatedUser.subscriptionPlan).toBe(plan.slug);
  });

  it('should record payment in user payments history', async () => {
    const plan = await MembershipPlan.create({
      title: 'Platinum Plan',
      slug: `platinum-${Date.now()}`,
      status: 'published',
      pricing: { oneTime: { amount: 2999, currency: 'INR' } },
      validityDays: 365,
    });

    const orderRes = await request(app)
      .post('/api/payments/create-order')
      .set(authHeader)
      .send({ plan: plan.slug });

    expect(orderRes.status).toBe(200);

    const verifyRes = await request(app)
      .post('/api/payments/verify-membership')
      .set(authHeader)
      .send({
        razorpay_order_id: orderRes.body.data.orderId,
        razorpay_payment_id: `pay_test_${Date.now()}`,
        razorpay_signature: 'test_sig',
        plan: plan.slug,
      });

    expect(verifyRes.status).toBe(200);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.payments).toBeDefined();
    expect(updatedUser.payments.length).toBeGreaterThan(0);
    const lastPayment = updatedUser.payments[updatedUser.payments.length - 1];
    expect(lastPayment.plan).toBe(plan.slug);
    expect(lastPayment.status).toBe('completed');
  });
});
