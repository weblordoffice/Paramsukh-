import { test, expect } from '@playwright/test';
import { loginAsAdmin, mockApi, CORS_HEADERS } from './helpers/auth.mock';

test.describe('Users Management (F02)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock plans
    await mockApi(page, '**/api/membership-plans', {
      success: true,
      data: [
        { _id: 'plan-free', slug: 'free', title: 'Free Plan', status: 'published' },
        { _id: 'plan-pro', slug: 'pro', title: 'Pro Plan', status: 'published' },
      ],
    });

    // 2. Mock users listing
    await mockApi(page, '**/api/user/all', {
      success: true,
      users: [
        {
          _id: 'user-id-111',
          displayName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+919876543210',
          subscriptionPlan: 'free',
          isActive: true,
          createdAt: '2026-07-15T00:00:00.000Z',
        },
      ],
    });
  });

  test('should create, edit, and delete a user successfully', async ({ page }) => {
    // Mock user creation API
    let createPayload: any = null;
    await page.route('**/api/user/create', async (route) => {
      createPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            _id: 'user-id-222',
            displayName: createPayload.displayName,
            email: createPayload.email,
            phone: createPayload.phone,
            subscriptionPlan: createPayload.subscriptionPlan,
            isActive: true,
            createdAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Mock user update API
    let editPayload: any = null;
    await page.route('**/api/user/user-id-111', async (route) => {
      if (route.request().method() === 'PATCH') {
        editPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          headers: CORS_HEADERS,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          headers: CORS_HEADERS,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Sign in and go to Users Management
    await loginAsAdmin(page);
    await page.goto('/dashboard/users');

    // Verify existing user is listed
    await expect(page.locator('text=Jane Doe')).toBeVisible();

    // 1. ADD USER FLOW
    await page.locator('button:has-text("Add User")').click();
    await expect(page.locator('h2:has-text("Add New User")')).toBeVisible();

    // Fill in form details
    await page.locator('input[placeholder="John Doe"]').fill('John Test');
    await page.locator('input[placeholder="+91 9876543210"]').fill('+919999999999');
    await page.locator('input[placeholder="john@example.com"]').fill('john.test@example.com');
    await page.locator('form select').selectOption('pro');

    // Submit user form
    await page.locator('form').locator('button[type="submit"]').click();

    // Assert create payload
    expect(createPayload).not.toBeNull();
    expect(createPayload.displayName).toBe('John Test');
    expect(createPayload.phone).toBe('+919999999999');
    expect(createPayload.email).toBe('john.test@example.com');
    expect(createPayload.subscriptionPlan).toBe('pro');

    // 2. EDIT USER FLOW
    await page.locator('button[title="Edit User"]').first().click();
    await expect(page.locator('h2:has-text("Edit User")')).toBeVisible();

    // Modify name
    await page.locator('input[placeholder="John Doe"]').fill('Jane Updated');
    await page.locator('form').locator('button[type="submit"]').click();

    // Assert edit payload
    expect(editPayload).not.toBeNull();
    expect(editPayload.displayName).toBe('Jane Updated');

    // 3. DELETE USER FLOW
    // Dismiss/accept window confirm delete dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Are you sure you want to delete this user?');
      await dialog.accept();
    });

    await page.locator('button[title="Delete User"]').first().click();
  });
});
