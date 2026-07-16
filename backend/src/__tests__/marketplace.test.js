import request from 'supertest';
import createTestApp from './app.js';
import {
  createTestUser,
  generateUserToken,
  getAuthHeader,
  getAdminApiKeyHeader,
} from './helpers.js';
import { setupDB } from './db.js';

const app = createTestApp();
setupDB();

describe('Shop & Products Module', () => {
  describe('GET /api/shops', () => {
    it('should return list of shops', async () => {
      const res = await request(app).get('/api/shops');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/products', () => {
    it('should return product list', async () => {
      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should support search', async () => {
      const res = await request(app)
        .get('/api/products/search')
        .query({ search: 'yoga' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return featured products', async () => {
      const res = await request(app).get('/api/products/featured');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Cart Module - /api/cart', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await createTestUser({ assessmentCompleted: true });
    token = generateUserToken(user._id);
  });

  describe('GET /api/cart', () => {
    it('should return empty cart for new user', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject without auth', async () => {
      const res = await request(app).get('/api/cart');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});

describe('Wishlist Module - /api/wishlist', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await createTestUser({ assessmentCompleted: true });
    token = generateUserToken(user._id);
  });

  describe('GET /api/wishlist', () => {
    it('should return empty wishlist for new user', async () => {
      const res = await request(app)
        .get('/api/wishlist')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Orders Module - /api/orders', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await createTestUser({ assessmentCompleted: true });
    token = generateUserToken(user._id);
  });

  describe('GET /api/orders/my-orders', () => {
    it('should return empty orders for new user', async () => {
      const res = await request(app)
        .get('/api/orders/my-orders')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Address Module - /api/addresses', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await createTestUser({ assessmentCompleted: true });
    token = generateUserToken(user._id);
  });

  describe('GET /api/addresses', () => {
    it('should return empty addresses for new user', async () => {
      const res = await request(app)
        .get('/api/addresses')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/addresses/add', () => {
    it('should create a new address', async () => {
      const res = await request(app)
        .post('/api/addresses/add')
        .set(getAuthHeader(token))
        .send({
          fullName: 'Test User',
          phone: '9876543210',
          pincode: '110001',
          state: 'Delhi',
          city: 'New Delhi',
          addressLine1: '123 Test Street, Connaught Place',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid pincode', async () => {
      const res = await request(app)
        .post('/api/addresses/add')
        .set(getAuthHeader(token))
        .send({
          fullName: 'Test User',
          phone: '9876543210',
          pincode: '123',
          state: 'Delhi',
          city: 'New Delhi',
          addressLine1: '123 Test Street',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/addresses/add')
        .set(getAuthHeader(token))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

describe('Donations Module - /api/donations', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await createTestUser({ assessmentCompleted: true });
    token = generateUserToken(user._id);
  });

  describe('GET /api/donations', () => {
    it('should return empty donations for new user', async () => {
      const res = await request(app)
        .get('/api/donations')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Blogs Module - /api/blogs', () => {
  describe('GET /api/blogs', () => {
    it('should return blog list', async () => {
      const res = await request(app).get('/api/blogs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Podcasts Module - /api/podcasts', () => {
  describe('GET /api/podcasts', () => {
    it('should return podcast list', async () => {
      const res = await request(app).get('/api/podcasts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Support Module - /api/support', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await createTestUser({ assessmentCompleted: true });
    token = generateUserToken(user._id);
  });

  describe('POST /api/support', () => {
    it('should submit a support message', async () => {
      const res = await request(app)
        .post('/api/support')
        .set(getAuthHeader(token))
        .send({
          subject: 'Test Support Query',
          message: 'This is a test support message from automated tests.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/support/my-messages', () => {
    it('should return user messages', async () => {
      const res = await request(app)
        .get('/api/support/my-messages')
        .set(getAuthHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Membership Plans Module - /api/membership-plans', () => {
  describe('GET /api/membership-plans/public', () => {
    it('should return public membership plans', async () => {
      const res = await request(app).get('/api/membership-plans/public');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
