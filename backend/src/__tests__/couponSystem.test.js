import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { User } from '../models/user.models.js';
import Product from '../models/product.models.js';
import Category from '../models/category.models.js';
import Shop from '../models/shop.models.js';
import Cart from '../models/cart.models.js';
import Coupon from '../models/coupon.models.js';
import CouponUsage from '../models/couponUsage.models.js';
import Order from '../models/order.models.js';
import Address from '../models/address.models.js';
import { getAuthHeader, generateUserToken, getAdminApiKeyHeader } from './helpers.js';

setupDB();

const app = createTestApp();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

describe('Product Category Coupon System', () => {
  let user;
  let userToken;
  let shop;
  let wellnessCategory;
  let cosmeticCategory;
  let wellnessProduct;
  let cosmeticProduct;
  let address;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Shop.deleteMany({});
    await Cart.deleteMany({});
    await Coupon.deleteMany({});
    await CouponUsage.deleteMany({});
    await Order.deleteMany({});
    await Address.deleteMany({});

    user = await User.create({
      phone: `+91${uid()}`,
      displayName: 'Shop Customer',
      email: `${uid()}@test.com`,
      authProvider: 'phone'
    });
    userToken = generateUserToken(user._id);

    const { DeviceSession } = await import('../models/deviceSession.models.js');
    await DeviceSession.create({
      user: user._id,
      deviceId: 'test-device-id',
      deviceName: 'Test Phone',
      os: 'iOS',
      browser: 'App',
      authProvider: 'phone'
    });

    address = await Address.create({
      user: user._id,
      fullName: 'John Doe',
      phone: '9876543210',
      addressLine1: 'Flat 101, Residency',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      country: 'India'
    });

    shop = await Shop.create({
      name: 'Gurukul Wellness Shop',
      slug: 'gurukul-shop',
      owner: user._id,
      description: 'Herbs and natural supplements',
      phone: '9876543210',
      email: 'shop@gurukul.com',
      address: {
        street: 'Main Street',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001'
      }
    });

    wellnessCategory = await Category.create({
      name: 'Wellness Supplements',
      slug: 'wellness-supplements'
    });

    cosmeticCategory = await Category.create({
      name: 'Cosmetics',
      slug: 'cosmetics'
    });

    wellnessProduct = await Product.create({
      shop: shop._id,
      name: 'Organic Ashwagandha Powder',
      slug: 'organic-ashwagandha',
      description: 'Stress relief root extract powder',
      category: wellnessCategory._id,
      pricing: { mrp: 500, sellingPrice: 400, discount: 20 },
      inventory: { stock: 50 }
    });

    cosmeticProduct = await Product.create({
      shop: shop._id,
      name: 'Herbal Face Wash',
      slug: 'herbal-face-wash',
      description: 'Neem & Tulsi skin wash',
      category: cosmeticCategory._id,
      pricing: { mrp: 200, sellingPrice: 150, discount: 25 },
      inventory: { stock: 30 }
    });
  });

  it('should allow admin to create a new category restricted coupon', async () => {
    const res = await request(app)
      .post('/api/admin/coupons')
      .set(getAdminApiKeyHeader())
      .send({
        code: 'WELLNESS30',
        description: '30% off wellness supplements',
        discountType: 'percentage',
        discountValue: 30,
        applicableOn: 'category',
        categories: [wellnessCategory._id.toString()],
        minOrderValue: 200,
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(Date.now() + 86400000)
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.coupon.code).toBe('WELLNESS30');
    expect(res.body.coupon.applicableOn).toBe('category');
    expect(res.body.coupon.categories).toContain(wellnessCategory._id.toString());
  });

  it('should not apply category coupon if cart does not contain matching category items', async () => {
    await request(app)
      .post('/api/cart/add')
      .set(getAuthHeader(userToken))
      .send({ productId: cosmeticProduct._id, quantity: 2 });

    await Coupon.create({
      code: 'WELLNESS30',
      description: '30% off wellness supplements',
      discountType: 'percentage',
      discountValue: 30,
      applicableOn: 'category',
      categories: [wellnessCategory._id],
      minOrderValue: 100,
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 86400000)
    });

    const res = await request(app)
      .post('/api/cart/apply-coupon')
      .set(getAuthHeader(userToken))
      .send({ code: 'WELLNESS30' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('not applicable');
  });

  it('should calculate discount strictly on matching items when coupon is applied', async () => {
    await request(app)
      .post('/api/cart/add')
      .set(getAuthHeader(userToken))
      .send({ productId: wellnessProduct._id, quantity: 1 });

    await request(app)
      .post('/api/cart/add')
      .set(getAuthHeader(userToken))
      .send({ productId: cosmeticProduct._id, quantity: 1 });

    await Coupon.create({
      code: 'WELLNESS50',
      description: '50% off wellness items',
      discountType: 'percentage',
      discountValue: 50,
      applicableOn: 'category',
      categories: [wellnessCategory._id],
      minOrderValue: 200,
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 86400000)
    });

    const res = await request(app)
      .post('/api/cart/apply-coupon')
      .set(getAuthHeader(userToken))
      .send({ code: 'WELLNESS50' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cart.discount).toBe(200);
    expect(res.body.data.cart.coupon.code).toBe('WELLNESS50');
  });

  it('should record coupon usage and update stats upon successful checkout', async () => {
    await request(app)
      .post('/api/cart/add')
      .set(getAuthHeader(userToken))
      .send({ productId: wellnessProduct._id, quantity: 2 });

    const coupon = await Coupon.create({
      code: 'FLAT100',
      description: 'Flat 100 off',
      discountType: 'flat',
      discountValue: 100,
      applicableOn: 'all',
      minOrderValue: 300,
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 86400000)
    });

    await request(app)
      .post('/api/cart/apply-coupon')
      .set(getAuthHeader(userToken))
      .send({ code: 'FLAT100' });

    const res = await request(app)
      .post('/api/orders/create')
      .set(getAuthHeader(userToken))
      .send({
        addressId: address._id,
        paymentMethod: 'cod'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const usage = await CouponUsage.findOne({ coupon: coupon._id, user: user._id });
    expect(usage).not.toBeNull();
    expect(usage.discountAmount).toBe(100);

    const updatedCoupon = await Coupon.findById(coupon._id);
    expect(updatedCoupon.currentUsageCount).toBe(1);
    expect(updatedCoupon.stats.totalUsed).toBe(1);
    expect(updatedCoupon.stats.totalDiscount).toBe(100);
  });
});
