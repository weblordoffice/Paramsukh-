import { Page, expect } from '@playwright/test';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export async function setupAdminMockRoute(page: Page) {
  // Global CORS preflight interceptor
  await page.route('**/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
      return;
    }
    await route.fallback();
  });

  // 1. Mock Next-Auth session endpoint
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          name: 'Super Admin',
          email: 'superadmin@example.com',
          image: 'https://lh3.googleusercontent.com/a/mock',
        },
        id_token: 'mock-id-token',
        access_token: 'mock-access-token',
        expires: '2030-01-01T00:00:00.000Z',
      }),
    });
  });

  // 2. Mock Admin Google auth exchange
  await page.route('**/api/admin/auth/google', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        token: 'mock-jwt-token-12345',
        refreshToken: 'mock-refresh-token-12345',
        expiresIn: 3600 * 1000,
        admin: {
          _id: 'admin-id-123',
          name: 'Super Admin',
          email: 'superadmin@example.com',
          role: 'super_admin',
          isActive: true,
          permissions: ['manage_users', 'manage_courses', 'manage_settings'],
        },
      }),
    });
  });
}

export async function loginAsAdmin(page: Page) {
  await setupAdminMockRoute(page);

  await page.route('**/api/admin/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        token: 'mock-jwt-token-12345',
        refreshToken: 'mock-refresh-token-12345',
        expiresIn: 3600 * 1000,
        admin: {
          _id: 'admin-id-123',
          name: 'Super Admin',
          email: 'admin@paramsukh.com',
          role: 'super_admin',
          isActive: true,
          permissions: ['manage_users', 'manage_courses', 'manage_settings'],
        },
      }),
    });
  });

  await page.goto('/');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function mockApi(page: Page, urlPattern: string, body: any, status = 200) {
  await page.route(urlPattern, async (route) => {
    await route.fulfill({
      status,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}
