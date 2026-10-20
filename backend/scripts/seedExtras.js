import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import connectDatabase from '../src/config/database.js';
import Address from '../src/models/address.models.js';
import Coupon from '../src/models/coupon.models.js';
import { DeviceSession } from '../src/models/deviceSession.models.js';
import { Donation } from '../src/models/donation.models.js';
import Order from '../src/models/order.models.js';
import PointTransaction from '../src/models/pointTransaction.models.js';
import Product from '../src/models/product.models.js';
import Referral from '../src/models/referral.models.js';
import Review from '../src/models/review.models.js';
import SupportMessage from '../src/models/supportMessage.models.js';
import { User } from '../src/models/user.models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DAY_MS = 24 * 60 * 60 * 1000;

const resolveUser = async () => {
  const email = process.env.SEED_USER_EMAIL;
  if (email) {
    const byEmail = await User.findOne({ email });
    if (byEmail) return byEmail;
  }
  const demo = await User.findOne({ phone: '+919999999999' });
  if (demo) return demo;
  return User.findOne({}).sort({ createdAt: 1 });
};

const run = async () => {
  try {
    await connectDatabase();
    console.log('Connected DB =', mongoose.connection.name);

    const user = await resolveUser();
    if (!user) throw new Error('No target user found');
    const userPhone = user.phone || '+919999999999';
    console.log(`Seeding extras for: ${user.displayName} <${user.email || user.phone}>`);

    // ---- Referred friends (also reused as review authors) ----
    const referredDefs = [
      { displayName: 'Priya Sharma', email: 'seed.priya@paramsukh.test', phone: '+919000000101' },
      { displayName: 'Karan Mehta', email: 'seed.karan@paramsukh.test', phone: '+919000000102' },
      { displayName: 'Sneha Rao', email: 'seed.sneha@paramsukh.test', phone: '+919000000103' },
    ];
    const referred = [];
    for (const def of referredDefs) {
      referred.push(await User.findOneAndUpdate(
        { email: def.email },
        { $set: { ...def, authProvider: 'phone', referredBy: user._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ));
    }

    // ---- Addresses ----
    await Address.deleteMany({ user: user._id });
    const homeAddress = await Address.create({
      user: user._id, type: 'home', fullName: user.displayName, phone: userPhone,
      addressLine1: '12 Wellness Avenue', city: 'Delhi', state: 'Delhi', pincode: '110001', country: 'India', isDefault: true,
    });
    await Address.create({
      user: user._id, type: 'work', fullName: user.displayName, phone: userPhone,
      addressLine1: 'Tower B, Cyber Park', city: 'Noida', state: 'Uttar Pradesh', pincode: '201301', country: 'India', isDefault: false,
    });

    // ---- Orders (various statuses) ----
    const products = await Product.find({ isActive: true }).limit(6).lean();
    if (!products.length) throw new Error('No products found — run seedShop first');

    const deliveryAddress = {
      fullName: homeAddress.fullName, phone: homeAddress.phone,
      addressLine1: homeAddress.addressLine1, city: homeAddress.city,
      state: homeAddress.state, pincode: homeAddress.pincode, country: 'India',
    };

    const orderDefs = [
      { status: 'delivered', paymentStatus: 'completed', method: 'razorpay', daysAgo: 14 },
      { status: 'shipped', paymentStatus: 'completed', method: 'upi', daysAgo: 6 },
      { status: 'processing', paymentStatus: 'completed', method: 'card', daysAgo: 3 },
      { status: 'pending', paymentStatus: 'pending', method: 'cod', daysAgo: 1 },
      { status: 'cancelled', paymentStatus: 'refunded', method: 'razorpay', daysAgo: 9, cancelled: true },
    ];

    let seq = 1;
    for (const o of orderDefs) {
      const chosen = products.slice(0, 2 + (seq % 2));
      const items = chosen.map((p, i) => {
        const qty = 1 + (i % 2);
        const price = p.pricing?.sellingPrice ?? 0;
        return {
          product: p._id, productName: p.name, productImage: p.images?.[0]?.url,
          shop: p.shop, quantity: qty, price, tax: 0, subtotal: price * qty,
        };
      });
      const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
      const orderNumber = `SEEDORD${String(seq).padStart(4, '0')}`;
      const createdAt = new Date(Date.now() - o.daysAgo * DAY_MS);

      const payload = {
        orderNumber, user: user._id, items, deliveryAddress,
        pricing: { subtotal, discount: 0, shippingCharge: 0, tax: 0, total: subtotal },
        payment: { method: o.method, status: o.paymentStatus },
        status: o.status, createdAt,
        statusHistory: [
          { status: 'pending', timestamp: createdAt, comment: 'Order placed' },
          { status: o.status, timestamp: createdAt, comment: '' },
        ],
      };
      if (o.cancelled) {
        payload.cancelledAt = new Date(createdAt.getTime() + DAY_MS);
        payload.cancellation = { reason: 'Changed my mind', cancelledBy: user._id };
      }

      await Order.findOneAndUpdate({ orderNumber }, { $set: payload }, { upsert: true, new: true, setDefaultsOnInsert: true });
      seq += 1;
    }

    // ---- Product reviews ----
    // The Review model has a unique sparse index on { shop, user, order }; with order null
    // that means at most one review per (user, shop). Use dedicated reviewer users.
    const reviewerDefs = Array.from({ length: 8 }, (_, i) => ({
      displayName: `Reviewer ${i + 1}`,
      email: `seed.reviewer${i + 1}@paramsukh.test`,
      phone: `+9190000010${i}`,
    }));
    const reviewers = [];
    for (const def of reviewerDefs) {
      reviewers.push(await User.findOneAndUpdate(
        { email: def.email },
        { $set: { ...def, authProvider: 'phone' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ));
    }
    await Review.deleteMany({ user: { $in: [...reviewers.map((r) => r._id), ...referred.map((r) => r._id), user._id] } });

    const reviewTexts = [
      { rating: 5, comment: 'Excellent quality, exactly as described. Highly recommend.' },
      { rating: 4, comment: 'Good value for money and it arrived well packed.' },
      { rating: 5, comment: 'Fast delivery and beautiful finish. Very happy with it.' },
      { rating: 4, comment: 'Does the job well. Would buy again.' },
    ];
    const reviewTargets = products.slice(0, 4);
    for (let i = 0; i < reviewTargets.length; i += 1) {
      const product = reviewTargets[i];
      for (let j = 0; j < 2; j += 1) {
        const reviewer = reviewers[(i * 2 + j) % reviewers.length];
        const text = reviewTexts[(i + j) % reviewTexts.length];
        await Review.create({
          user: reviewer._id, reviewType: 'product', product: product._id, shop: product.shop,
          rating: text.rating, comment: text.comment, isVerifiedPurchase: true, status: 'approved', isVisible: true,
        });
      }
      const revs = await Review.find({ product: product._id, isVisible: true }).select('rating').lean();
      const avg = revs.reduce((s, r) => s + r.rating, 0) / revs.length;
      await Product.updateOne(
        { _id: product._id },
        { $set: { 'rating.average': Math.round(avg * 10) / 10, 'rating.count': revs.length } }
      );
    }

    // ---- Coupons ----
    const coupons = [
      { code: 'WELCOME10', description: '10% off your first order', discountType: 'percentage', discountValue: 10, maxDiscount: 200, minOrderValue: 500, applicableOn: 'all', startDate: new Date(), endDate: new Date(Date.now() + 365 * DAY_MS), isActive: true },
      { code: 'FLAT100', description: 'Flat ₹100 off orders above ₹800', discountType: 'flat', discountValue: 100, minOrderValue: 800, applicableOn: 'all', startDate: new Date(), endDate: new Date(Date.now() + 365 * DAY_MS), isActive: true },
      { code: 'YOGA20', description: '20% off wellness favourites', discountType: 'percentage', discountValue: 20, maxDiscount: 500, minOrderValue: 999, applicableOn: 'all', startDate: new Date(), endDate: new Date(Date.now() + 180 * DAY_MS), isActive: true },
    ];
    for (const c of coupons) {
      await Coupon.findOneAndUpdate({ code: c.code }, { $set: c }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }

    // ---- Referral program ----
    const referralCode = 'PARAM-NEERAJ';
    await User.updateOne({ _id: user._id }, { $set: { referralCode } });
    for (let i = 0; i < referred.length; i += 1) {
      await Referral.findOneAndUpdate(
        { referredUser: referred[i]._id },
        { $set: { referrer: user._id, referredUser: referred[i]._id, referralCode, metadata: { channel: 'link' } } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const txDefs = [
      { type: 'user.signup', points: 50, referredUserId: referred[0]._id },
      { type: 'user.first_purchase', points: 100 },
      { type: 'user.course_complete', points: 75, referredUserId: referred[0]._id },
    ];
    let balance = 0;
    for (const t of txDefs) {
      balance += t.points;
      await PointTransaction.findOneAndUpdate(
        { userId: user._id, type: t.type, referredUserId: t.referredUserId || null },
        {
          $set: {
            userId: user._id, type: t.type, points: t.points, balance, pointValue: 1, rupeeValue: t.points,
            status: 'active', referredUserId: t.referredUserId || null,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    await User.updateOne({ _id: user._id }, { $set: { referralPoints: balance, totalPointsEarned: balance } });

    // ---- Support tickets ----
    await SupportMessage.deleteMany({ user: user._id });
    await SupportMessage.create([
      { user: user._id, message: 'My payment was deducted but the membership did not activate. Please help.', status: 'pending', priority: 'high', category: 'billing' },
      { user: user._id, message: 'The app freezes when I open a course video on Android 14.', status: 'in_progress', priority: 'medium', category: 'technical', readAt: new Date() },
      { user: user._id, message: 'Thank you for the wonderful sessions. Could you add more evening batches?', status: 'resolved', priority: 'low', category: 'feedback', adminReply: { message: 'Thank you! We are adding more evening batches soon.', repliedAt: new Date() }, resolvedAt: new Date() },
    ]);

    // ---- Device sessions ----
    await DeviceSession.deleteMany({ user: user._id });
    await DeviceSession.create([
      { user: user._id, deviceId: 'seed-device-current', authProvider: 'clerk', deviceName: 'Pixel 8', browser: 'Chrome', os: 'Android 14', isRevoked: false, lastSeen: new Date() },
      { user: user._id, deviceId: 'seed-device-old', authProvider: 'phone', deviceName: 'iPhone 13', browser: 'Safari', os: 'iOS 17', isRevoked: true, lastSeen: new Date(Date.now() - 30 * DAY_MS) },
    ]);

    // ---- Donations ----
    const donations = [
      { amount: 501, status: 'completed', transactionId: 'seed_don_tx_1', receiptNumber: 'SEEDDON0001', message: 'For the gurukul fund', daysAgo: 21 },
      { amount: 1100, status: 'completed', transactionId: 'seed_don_tx_2', receiptNumber: 'SEEDDON0002', message: 'For community programs', daysAgo: 12 },
      { amount: 251, status: 'initiated', transactionId: 'seed_don_tx_3', receiptNumber: 'SEEDDON0003', message: 'Monthly support', daysAgo: 2 },
    ];
    for (const d of donations) {
      await Donation.findOneAndUpdate(
        { transactionId: d.transactionId },
        {
          $set: {
            userId: user._id, userName: user.displayName, phone: userPhone, amount: d.amount, currency: 'INR',
            status: d.status, paymentMethod: 'razorpay', transactionId: d.transactionId, receiptNumber: d.receiptNumber,
            message: d.message, isAnonymous: false, createdAt: new Date(Date.now() - d.daysAgo * DAY_MS),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // ---- Badges ----
    const badgeIds = ['first-step', 'knowledge-seeker', 'event-enthusiast', 'active-member'];
    await User.updateOne(
      { _id: user._id },
      { $set: { unlockedBadges: badgeIds.map((badgeId) => ({ badgeId, unlockedAt: new Date() })), loginCount: Math.max(user.loginCount || 0, 12) } }
    );

    const summary = {
      addresses: await Address.countDocuments({ user: user._id }),
      orders: await Order.countDocuments({ user: user._id }),
      reviews: await Review.countDocuments({ isVisible: true }),
      coupons: await Coupon.countDocuments({ isActive: true }),
      referrals: await Referral.countDocuments({ referrer: user._id }),
      pointTransactions: await PointTransaction.countDocuments({ userId: user._id }),
      supportTickets: await SupportMessage.countDocuments({ user: user._id }),
      deviceSessions: await DeviceSession.countDocuments({ user: user._id }),
      donations: await Donation.countDocuments({ userId: user._id }),
      badges: badgeIds.length,
    };
    console.log('Seeded extras summary:', JSON.stringify(summary, null, 2));
    console.log(`Shop address default: ${homeAddress._id} | products rated: ${Math.min(products.length, 4)}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed extras:', error);
    process.exit(1);
  }
};

run();
