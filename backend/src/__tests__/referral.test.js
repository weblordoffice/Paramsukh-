import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { createTestUser, createTestUser2, generateUserToken, getAuthHeader } from './helpers.js';
import { User } from '../models/user.models.js';
import { Referral } from '../models/referral.models.js';
import { ReferralConfig } from '../models/referralConfig.models.js';
import { ReferralEarningRule } from '../models/referralEarningRule.models.js';
import { PointTransaction } from '../models/pointTransaction.models.js';
import { generateUniqueReferralCode } from '../lib/referralHelper.js';
import {
  getReferralValidation,
  fireTrigger,
  redeemPoints,
  releaseHeldPoints,
  expireOldPoints,
} from '../services/referral.service.js';
import Shop from '../models/shop.models.js';
import Category from '../models/category.models.js';
import Product from '../models/product.models.js';
import Cart from '../models/cart.models.js';
import Address from '../models/address.models.js';

const app = createTestApp();
setupDB();

const seedConfigAndRules = async (configOverrides = {}) => {
  // Start from a clean slate so getReferralValidation/fireTrigger always read exactly one config.
  await ReferralConfig.deleteMany({});
  await ReferralEarningRule.deleteMany({});
  await ReferralConfig.create({
    isActive: true,
    pointValueInRupees: 1,
    minRedemptionPoints: 1,
    maxRedemptionPercent: 50,
    minReferrerAccountAgeDays: 0,
    referralCodeFormat: 'random8',
    ...configOverrides,
  });
  await ReferralEarningRule.create({
    name: 'Signup', slug: 'signup-rule', triggerEvent: 'user.signup', pointsValue: 10, isActive: true,
  });
  await ReferralEarningRule.create({
    name: 'First Purchase', slug: 'fp-rule', triggerEvent: 'user.first_purchase', pointsValue: 20, isActive: true, holdDays: 0,
  });
};

describe('Referral - code generation', () => {
  beforeEach(async () => {
    await ReferralConfig.deleteMany({});
  });

  it('generates a unique code each call', async () => {
    const c1 = await generateUniqueReferralCode('Alice');
    const c2 = await generateUniqueReferralCode('Bob');
    expect(c1).toBeTruthy();
    expect(c2).toBeTruthy();
    expect(c1).not.toEqual(c2);
  });

  it('defaults to the PARAM- random format when no config', async () => {
    const code = await generateUniqueReferralCode();
    expect(code.startsWith('PARAM-')).toBe(true);
  });

  it('honors the displayName format from config', async () => {
    await ReferralConfig.create({ referralCodeFormat: 'displayName' });
    const code = await generateUniqueReferralCode('Alice Wonder');
    expect(code.startsWith('ALICE')).toBe(true);
  });

  it('honors the random12 format from config', async () => {
    await ReferralConfig.create({ referralCodeFormat: 'random12' });
    const code = await generateUniqueReferralCode();
    expect(code.startsWith('PARAM-')).toBe(true);
    expect(code.length).toBe('PARAM-'.length + 12);
  });
});

describe('Referral - getReferralValidation', () => {
  let referrer;
  let buyer;
  beforeEach(async () => {
    await seedConfigAndRules();
    referrer = await createTestUser2();
    referrer.referralCode = 'REFERRER-1';
    await referrer.save();
    buyer = await createTestUser();
  });

  it('accepts a valid code', async () => {
    const v = await getReferralValidation(referrer.referralCode, buyer._id, '1.2.3.4');
    expect(v.valid).toBe(true);
    expect(String(v.referrer._id)).toBe(String(referrer._id));
  });

  it('rejects an invalid code', async () => {
    const v = await getReferralValidation('DOES-NOT-EXIST', buyer._id, '1.2.3.4');
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/Invalid referral code/i);
  });

  it('rejects self-referral', async () => {
    const v = await getReferralValidation(referrer.referralCode, referrer._id, '1.2.3.4');
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/yourself/i);
  });

  it('rejects an already-referred user', async () => {
    const other = await createTestUser2();
    other.referralCode = 'OTHER-9';
    await other.save();
    await Referral.create({ referrer: other._id, referredUser: buyer._id, referralCode: other.referralCode });
    const v = await getReferralValidation(referrer.referralCode, buyer._id, '1.2.3.4');
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/Already referred/i);
  });

  it('is case-insensitive', async () => {
    const v = await getReferralValidation(referrer.referralCode.toLowerCase(), buyer._id, '1.2.3.4');
    expect(v.valid).toBe(true);
  });
});

describe('Referral - fireTrigger', () => {
  let referrer;
  let referred;
  beforeEach(async () => {
    await seedConfigAndRules();
    referrer = await createTestUser2();
    referrer.referralCode = 'REF-TRIGGER';
    await referrer.save();
    referred = await createTestUser();
  });

  it('awards signup points to the referrer', async () => {
    await fireTrigger('user.signup', { referrerId: referrer._id, referredUserId: referred._id });
    const refreshed = await User.findById(referrer._id);
    expect(refreshed.referralPoints).toBe(10);
    expect(refreshed.totalPointsEarned).toBe(10);
    expect(await PointTransaction.countDocuments({ userId: referrer._id })).toBe(1);
  });

  it('respects maxPointsPerReferrerTotal cap (atomic)', async () => {
    await ReferralConfig.updateOne({}, { maxPointsPerReferrerTotal: 15 });
    const r2 = await createTestUser();
    const r3 = await createTestUser();
    await fireTrigger('user.signup', { referrerId: referrer._id, referredUserId: r2._id });
    await fireTrigger('user.signup', { referrerId: referrer._id, referredUserId: r3._id });
    const refreshed = await User.findById(referrer._id);
    // Only the first 10 points fit under the 15 cap; the second is skipped.
    expect(refreshed.referralPoints).toBe(10);
    expect(await PointTransaction.countDocuments({ userId: referrer._id })).toBe(1);
  });

  it('holds first_purchase points per purchasePointsHoldDays', async () => {
    await ReferralConfig.updateOne({}, { purchasePointsHoldDays: 7 });
    await fireTrigger('user.first_purchase', { referrerId: referrer._id, referredUserId: referred._id, amount: 100 });
    const tx = await PointTransaction.findOne({ userId: referrer._id, type: 'user.first_purchase' });
    expect(tx).toBeTruthy();
    expect(tx.status).toBe('held');
    expect(tx.holdUntil).toBeTruthy();
    expect(tx.holdUntil.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('Referral - redeemPoints', () => {
  let user;
  beforeEach(async () => {
    await seedConfigAndRules();
    user = await createTestUser();
    user.referralPoints = 100;
    user.totalPointsEarned = 100;
    await user.save();
  });

  it('redeems points and decrements the balance', async () => {
    const res = await redeemPoints(user._id, 30, 'order-1');
    expect(res.success).toBe(true);
    const refreshed = await User.findById(user._id);
    expect(refreshed.referralPoints).toBe(70);
    expect(await PointTransaction.countDocuments({ userId: user._id, type: 'redeemed' })).toBe(1);
  });

  it('rejects below the minimum redemption', async () => {
    const res = await redeemPoints(user._id, 0, 'order-2');
    expect(res.success).toBe(false);
    const refreshed = await User.findById(user._id);
    expect(refreshed.referralPoints).toBe(100);
  });

  it('rejects when balance is insufficient (atomic guard)', async () => {
    const res = await redeemPoints(user._id, 500, 'order-3');
    expect(res.success).toBe(false);
    const refreshed = await User.findById(user._id);
    expect(refreshed.referralPoints).toBe(100);
  });
});

describe('Referral - cron cleanup', () => {
  let user;
  beforeEach(async () => {
    await seedConfigAndRules();
    user = await createTestUser();
  });

  it('releases held points whose hold period elapsed', async () => {
    await PointTransaction.create({
      userId: user._id, points: 25, type: 'user.signup', status: 'held',
      holdUntil: new Date(Date.now() - 1000),
    });
    const released = await releaseHeldPoints();
    expect(released).toBe(1);
    const tx = await PointTransaction.findOne({ userId: user._id });
    expect(tx.status).toBe('active');
  });

  it('expires old points and decrements the balance', async () => {
    user.referralPoints = 50;
    await user.save();
    await PointTransaction.create({
      userId: user._id, points: 20, type: 'user.signup', status: 'active',
      expiresAt: new Date(Date.now() - 1000),
    });
    const expired = await expireOldPoints();
    expect(expired).toBe(1);
    const refreshed = await User.findById(user._id);
    expect(refreshed.referralPoints).toBe(30);
    const tx = await PointTransaction.findOne({ userId: user._id });
    expect(tx.status).toBe('expired');
  });
});

describe('Referral - applyReferralCode route', () => {
  let referrer;
  let buyer;
  beforeEach(async () => {
    await seedConfigAndRules();
    referrer = await createTestUser2();
    referrer.referralCode = 'REF-APPLY-1';
    await referrer.save();
    buyer = await createTestUser();
  });

  it('links the referral and awards signup points', async () => {
    const res = await request(app)
      .post('/api/user/profile/referrals/apply')
      .set(getAuthHeader(generateUserToken(buyer._id)))
      .send({ code: referrer.referralCode });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const refreshedBuyer = await User.findById(buyer._id);
    expect(String(refreshedBuyer.referredBy)).toBe(String(referrer._id));
    expect(await Referral.countDocuments({ referredUser: buyer._id })).toBe(1);

    const refreshedReferrer = await User.findById(referrer._id);
    expect(refreshedReferrer.referralPoints).toBe(10);
  });

  it('leaves no inconsistent state when applying an invalid code', async () => {
    const res = await request(app)
      .post('/api/user/profile/referrals/apply')
      .set(getAuthHeader(generateUserToken(buyer._id)))
      .send({ code: 'SOME-OTHER-CODE' });
    expect(res.status).toBe(400);
    const refreshedBuyer = await User.findById(buyer._id);
    // An invalid apply must not set referredBy or create a Referral row.
    expect(refreshedBuyer.referredBy).toBeFalsy();
    expect(await Referral.countDocuments({ referredUser: buyer._id })).toBe(0);
  });

  it('is idempotent (rejects already-referred)', async () => {
    await request(app)
      .post('/api/user/profile/referrals/apply')
      .set(getAuthHeader(generateUserToken(buyer._id)))
      .send({ code: referrer.referralCode });
    const other = await createTestUser2();
    other.referralCode = 'REF-APPLY-2';
    await other.save();
    const res = await request(app)
      .post('/api/user/profile/referrals/apply')
      .set(getAuthHeader(generateUserToken(buyer._id)))
      .send({ code: other.referralCode });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Already referred/i);
  });

  it('is case-insensitive on apply', async () => {
    const res = await request(app)
      .post('/api/user/profile/referrals/apply')
      .set(getAuthHeader(generateUserToken(buyer._id)))
      .send({ code: referrer.referralCode.toLowerCase() });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Referral - maxRedemptionPercent at checkout', () => {
  let buyer;
  let address;
  let product;
  beforeEach(async () => {
    await seedConfigAndRules({ maxRedemptionPercent: 50, pointValueInRupees: 1 });
    buyer = await createTestUser();
    buyer.referralPoints = 1000;
    await buyer.save();

    const shop = await Shop.create({
      owner: buyer._id, name: 'Test Shop', slug: `shop-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      description: 'shop', email: 'shop@example.com', phone: '9999999999',
      address: { street: 's', city: 'c', state: 'st', pincode: '123456' },
    });
    const category = await Category.create({
      name: `Cat-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, slug: `cat-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    });
    product = await Product.create({
      shop: shop._id, name: 'Test Product', slug: `prod-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      description: 'product', category: category._id,
      pricing: { mrp: 200, sellingPrice: 100 }, inventory: { stock: 100, isUnlimited: true },
    });
    await Cart.create({
      user: buyer._id,
      items: [{ product: product._id, quantity: 1, price: 100 }],
      subtotal: 100, total: 100, shippingCharge: 0, tax: 0,
    });
    address = await Address.create({
      user: buyer._id, fullName: 'Buyer', phone: '9999999999',
      addressLine1: 'Line 1', city: 'City', state: 'State', pincode: '123456', country: 'India',
    });
  });

  it('caps the referral discount to maxRedemptionPercent of the order total', async () => {
    const res = await request(app)
      .post('/api/orders/create')
      .set(getAuthHeader(generateUserToken(buyer._id)))
      .send({ addressId: address._id.toString(), paymentMethod: 'cod', useReferralPoints: 1000 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const order = res.body.data.order;
    // 50% of 100 = 50 max; requested 1000 should be clamped to 50.
    expect(order.referralPoints.points).toBe(50);
    expect(order.referralPoints.discount).toBe(50);
    expect(order.pricing.total).toBe(50);

    const refreshed = await User.findById(buyer._id);
    expect(refreshed.referralPoints).toBe(950);
  });
});
