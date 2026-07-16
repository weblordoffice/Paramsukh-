import { test, expect } from '@playwright/test';
import { loginAsAdmin, mockApi, CORS_HEADERS } from './helpers/auth.mock';

test.describe('Operations Management (F09/F10/F11)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock orders list
    await mockApi(page, '**/api/orders/all', {
      success: true,
      orders: [
        {
          _id: 'order-123',
          orderNumber: 'ORD-54321',
          user: { displayName: 'Harry Potter', email: 'harry@hogwarts.edu', phone: '+917777777777' },
          items: [],
          totalAmount: 1250,
          status: 'pending',
          createdAt: new Date().toISOString(),
          deliveryAddress: {
            fullName: 'Harry Potter',
            addressLine1: 'Gryffindor Dormitory',
            city: 'Hogwarts',
            state: 'Scotland',
            pincode: '123456',
            phone: '+917777777777',
          },
          payment: { method: 'razorpay', status: 'captured' },
        },
      ],
    });

    // 2. Mock counseling bookings list
    await mockApi(page, '**/api/counseling/all', {
      success: true,
      data: {
        bookings: [
          {
            _id: 'booking-123',
            title: 'Spiritual Counseling Session',
            user: { displayName: 'Harry Potter' },
            counselor: { displayName: 'Albus Dumbledore' },
            status: 'confirmed',
            dateTime: new Date().toISOString(),
          },
        ],
      },
    });

    // 3. Mock community posts list
    await mockApi(page, '**/api/community/all', {
      success: true,
      posts: [
        {
          _id: 'post-123',
          userId: { displayName: 'Hermione Granger' },
          content: 'Exploring ancient sanskrit chants.',
          groupId: { name: 'Satsang Discussion Group' },
          likeCount: 15,
          commentCount: 4,
          isPinned: false,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  });

  test('should display orders list and perform order status update', async ({ page }) => {
    let patchStatusPayload: any = null;
    await page.route('**/api/orders/order-123/status', async (route) => {
      patchStatusPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await loginAsAdmin(page);
    await page.goto('/dashboard/orders');

    // Verify order is listed
    await expect(page.locator('text=ORD-54321')).toBeVisible();

    // Click View button to open detail modal
    await page.locator('button:has-text("View")').first().click();

    // Verify details load
    await expect(page.locator('h2:has-text("Order #ORD-54321")')).toBeVisible();

    // Update status to shipped
    await page.locator('button:has-text("shipped")').click();

    // Assert status update API request
    expect(patchStatusPayload).not.toBeNull();
    expect(patchStatusPayload.status).toBe('shipped');
  });

  test('should display community management posts and toggle pin status', async ({ page }) => {
    let pinToggled = false;
    await page.route('**/api/community/posts/post-123/pin', async (route) => {
      pinToggled = true;
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Post pinned successfully' }),
      });
    });

    await loginAsAdmin(page);
    await page.goto('/dashboard/community');

    // Verify community post is listed
    await expect(page.locator('text=Exploring ancient sanskrit chants.')).toBeVisible();

    // Click Pin button
    await page.locator('button[title="Pin post"]').first().click();
    expect(pinToggled).toBe(true);
  });
});
