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
import { Offer } from '../models/offer.models.js';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import {
  createTestUser,
  generateUserToken,
  getAuthHeader,
  getAdminApiKeyHeader,
} from './helpers.js';

setupDB();

const app = createTestApp();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);

const futureIso = (days = 1) => new Date(Date.now() + days * 86400000).toISOString();

describe('Shop promotions - offers and coupon restrictions', () => {
  let user;
  let token;
  let shop;
  let category;
  let product;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Shop.deleteMany({});
    await Cart.deleteMany({});
    await Coupon.deleteMany({});
    await Offer.deleteMany({});

    await MembershipPlan.findOneAndUpdate(
      { slug: 'gold' },
      {
        title: 'Gold Plan',
        slug: 'gold',
        description: 'Premium plan',
        price: 4999,
        duration: 'month',
        isActive: true,
        access: { communityAccess: true, accessMode: 'entitlement_only' },
      },
      { upsert: true, new: true }
    );

    user = await createTestUser({
      phone: `+91${uid()}`,
      email: `promo-${uid()}@test.com`,
      displayName: 'Promo User',
    });
    token = generateUserToken(user._id);

    shop = await Shop.create({
      name: 'Promo Shop',
      slug: `promo-shop-${uid()}`,
      owner: user._id,
      description: 'Promotions test shop',
      phone: '9876543210',
      email: 'promo-shop@test.com',
      address: {
        street: 'Main Street',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
      },
    });

    category = await Category.create({
      name: `Wellness ${uid()}`,
      slug: `wellness-${uid()}`,
    });

    product = await Product.create({
      shop: shop._id,
      name: 'Wellness Product',
      slug: `wellness-product-${uid()}`,
      description: 'Test product for promotions',
      category: category._id,
      pricing: { mrp: 500, sellingPrice: 400, discount: 20 },
      inventory: { stock: 50 },
    });
  });

  it('should auto-apply the best active offer and let a coupon take precedence', async () => {
    const offerRes = await request(app)
      .post('/api/admin/offers')
      .set(getAdminApiKeyHeader())
      .send({
        title: '20% Wellness Offer',
        description: 'Automatic 20% off wellness products',
        discountType: 'percentage',
        discountValue: 20,
        applicableOn: 'category',
        categories: [category._id.toString()],
        startDate: new Date(Date.now() - 3600000).toISOString(),
        endDate: futureIso(),
        isActive: true,
      });

    expect(offerRes.status).toBe(201);
    expect(offerRes.body.offer.title).toBe('20% Wellness Offer');

    const activeOffers = await request(app).get('/api/offers');
    expect(activeOffers.status).toBe(200);
    expect(activeOffers.body.offers.some((offer) => offer.title === '20% Wellness Offer')).toBe(true);

    await request(app)
      .post('/api/cart/add')
      .set(getAuthHeader(token))
      .send({ productId: product._id, quantity: 1 });

    const cartRes = await request(app)
      .get('/api/cart')
      .set(getAuthHeader(token));

    expect(cartRes.status).toBe(200);
    expect(cartRes.body.data.cart.discount).toBe(80);
    expect(cartRes.body.data.cart.offer.title).toBe('20% Wellness Offer');

    await Coupon.create({
      code: 'TENOFF',
      description: '10% off',
      discountType: 'percentage',
      discountValue: 10,
      applicableOn: 'all',
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });

    const couponRes = await request(app)
      .post('/api/cart/apply-coupon')
      .set(getAuthHeader(token))
      .send({ code: 'TENOFF' });

    expect(couponRes.status).toBe(200);
    expect(couponRes.body.data.cart.coupon.code).toBe('TENOFF');
    expect(couponRes.body.data.cart.discount).toBe(40);
    expect(couponRes.body.data.cart.offer).toBeFalsy();

    const updated = await request(app)
      .patch(`/api/admin/offers/${offerRes.body.offer._id}`)
      .set(getAdminApiKeyHeader())
      .send({ title: 'Updated Wellness Offer' });
    expect(updated.status).toBe(200);
    expect(updated.body.offer.title).toBe('Updated Wellness Offer');

    const removed = await request(app)
      .delete(`/api/admin/offers/${offerRes.body.offer._id}`)
      .set(getAdminApiKeyHeader());
    expect(removed.status).toBe(200);
  });

  it('should not apply expired offers', async () => {
    await Offer.create({
      title: 'Expired Offer',
      description: 'Expired',
      discountType: 'percentage',
      discountValue: 50,
      applicableOn: 'all',
      startDate: new Date(Date.now() - 2 * 86400000),
      endDate: new Date(Date.now() - 86400000),
      isActive: true,
    });

    await request(app)
      .post('/api/cart/add')
      .set(getAuthHeader(token))
      .send({ productId: product._id, quantity: 1 });

    const cartRes = await request(app)
      .get('/api/cart')
      .set(getAuthHeader(token));

    expect(cartRes.body.data.cart.discount).toBe(0);
    expect(cartRes.body.data.cart.offer).toBeFalsy();
  });

});
