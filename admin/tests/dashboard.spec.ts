import { test, expect } from '@playwright/test';
import { loginAsAdmin, mockApi } from './helpers/auth.mock';

test.describe('Dashboard (F01)', () => {
  test('should load dashboard stats successfully', async ({ page }) => {
    // Mock dashboard metrics endpoints
    await mockApi(page, '**/api/user/all', {
      success: true,
      users: [{ _id: '1' }, { _id: '2' }, { _id: '3' }],
    });

    await mockApi(page, '**/api/courses/all', {
      success: true,
      courses: [{ _id: 'c1' }, { _id: 'c2' }],
    });

    await mockApi(page, '**/api/events/all', {
      success: true,
      events: [{ _id: 'e1' }],
    });

    await mockApi(page, '**/api/products', {
      success: true,
      products: [{ _id: 'p1' }, { _id: 'p2' }, { _id: 'p3' }, { _id: 'p4' }],
    });

    await mockApi(page, '**/api/orders/all', {
      success: true,
      data: {
        orders: [{ _id: 'o1' }, { _id: 'o2' }, { _id: 'o3' }, { _id: 'o4' }, { _id: 'o5' }],
      },
    });

    await mockApi(page, '**/api/counseling/all', {
      success: true,
      data: {
        bookings: [{ _id: 'b1' }, { _id: 'b2' }],
      },
    });

    // 1. Perform mock admin login
    await loginAsAdmin(page);

    // 2. Expect redirection/navigation to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // 3. Verify statistics cards reflect the mock dataset lengths
    await expect(page.locator('text=Total Users').locator('..').locator('text=3')).toBeVisible();
    await expect(page.locator('text=Active Courses').locator('..').locator('text=2')).toBeVisible();
    await expect(page.locator('text=Upcoming Events').locator('..').locator('text=1')).toBeVisible();
    await expect(page.locator('text=Total Orders').locator('..').locator('text=5')).toBeVisible();
  });
});
