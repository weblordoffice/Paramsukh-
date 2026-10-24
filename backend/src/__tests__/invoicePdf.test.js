import request from 'supertest';
import mongoose from 'mongoose';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import {
  createTestUser,
  createTestUser2,
  createTestDeviceSession,
  generateUserToken,
  getAuthHeader,
} from './helpers.js';
import Order from '../models/order.models.js';

const app = createTestApp();
setupDB();

const binaryParser = (res, callback) => {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => callback(null, Buffer.from(data, 'binary')));
};

const createOrder = async (user) =>
  Order.create({
    user: user._id,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        productName: 'Yoga Mat',
        shop: new mongoose.Types.ObjectId(),
        quantity: 2,
        price: 499,
        tax: 179.64,
        subtotal: 998,
        variant: { name: 'Color', option: 'Blue' },
      },
      {
        product: new mongoose.Types.ObjectId(),
        productName: 'Incense Pack',
        shop: new mongoose.Types.ObjectId(),
        quantity: 1,
        price: 199,
        tax: 35.82,
        subtotal: 199,
      },
    ],
    deliveryAddress: {
      fullName: 'Test User',
      phone: '9876543210',
      addressLine1: '12 Main Road',
      addressLine2: 'Near Park',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      country: 'India',
    },
    pricing: {
      subtotal: 1197,
      discount: 100,
      shippingCharge: 50,
      tax: 215.46,
      total: 1362.46,
    },
    coupon: { code: 'TEST10', discount: 100, discountType: 'fixed' },
    payment: {
      method: 'razorpay',
      status: 'completed',
      razorpayPaymentId: 'pay_test_123',
    },
    status: 'confirmed',
    customerNotes: 'Please deliver before 6 PM.',
  });

describe('Order Invoice PDF', () => {
  it('generates an automatic invoice number and returns a PDF', async () => {
    const user = await createTestUser({ assessmentCompleted: true });
    const token = generateUserToken(user._id);
    const order = await createOrder(user);

    expect(order.invoiceNumber).toMatch(/^INV/);

    const res = await request(app)
      .get(`/api/orders/${order._id}/invoice`)
      .set(getAuthHeader(token))
      .buffer(true)
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain(`${order.invoiceNumber}.pdf`);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('supports the legacy JSON invoice representation', async () => {
    const user = await createTestUser({ assessmentCompleted: true });
    const token = generateUserToken(user._id);
    const order = await createOrder(user);

    const res = await request(app)
      .get(`/api/orders/${order._id}/invoice?format=json`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoice.invoiceNumber).toBe(order.invoiceNumber);
    expect(res.body.data.invoice.downloadUrl).toBe(`/api/orders/${order._id}/invoice`);
  });

  it('rejects invoice access without authentication', async () => {
    const user = await createTestUser({ assessmentCompleted: true });
    const order = await createOrder(user);

    const res = await request(app).get(`/api/orders/${order._id}/invoice`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('prevents another user from downloading someone else\'s invoice', async () => {
    const user = await createTestUser({ assessmentCompleted: true });
    const order = await createOrder(user);
    const otherUser = await createTestUser2();
    await createTestDeviceSession(otherUser._id);

    const res = await request(app)
      .get(`/api/orders/${order._id}/invoice`)
      .set(getAuthHeader(generateUserToken(otherUser._id)));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Order not found');
  });
});
