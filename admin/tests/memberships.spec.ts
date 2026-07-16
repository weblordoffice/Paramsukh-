import { test, expect } from '@playwright/test';
import { loginAsAdmin, mockApi, CORS_HEADERS } from './helpers/auth.mock';

test.describe('Memberships & Plans Builder (F03/F04)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user membership lists
    await mockApi(page, '**/api/user/all', {
      success: true,
      users: [],
    });

    // Mock membership plans lists
    await mockApi(page, '**/api/membership-plans', {
      success: true,
      data: [
        {
          _id: 'plan-pro',
          title: 'Pro Plan',
          slug: 'pro',
          status: 'draft',
          displayOrder: 1,
          validityDays: 365,
          pricing: { oneTime: { amount: 1500, currency: 'INR' } },
        },
      ],
    });
  });

  test('should view plans, create new plan, and toggle status', async ({ page }) => {
    let savePayload: any = null;
    
    // Mock plan creation API
    await page.route('**/api/membership-plans', async (route) => {
      if (route.request().method() === 'POST') {
        savePayload = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          headers: CORS_HEADERS,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { _id: 'plan-new', ...savePayload },
          }),
        });
      } else {
        await route.fallback();
      }
    });

    // Mock quick status updates
    let statusPayload: any = null;
    await page.route('**/api/membership-plans/plan-pro/status', async (route) => {
      statusPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Login and go to Plans
    await loginAsAdmin(page);
    await page.goto('/dashboard/plans');

    // Verify existing plan is listed
    await expect(page.locator('text=Pro Plan').first()).toBeVisible();

    // 1. CREATE NEW PLAN
    await page.locator('button:has-text("New Plan")').click();
    await expect(page.locator('h2:has-text("Create Plan")')).toBeVisible();

    // Fill form
    await page.locator('input[placeholder="Silver"]').fill('Super Gold');
    await page.locator('input[placeholder="silver"]').fill('super-gold');
    await page.locator('input[type="number"]').first().fill('10'); // displayOrder
    await page.locator('input[type="number"]').nth(1).fill('9999'); // Price
    await page.locator('input[type="number"]').nth(2).fill('365'); // Validity days

    // Save
    await page.locator('button:has-text("Save Plan")').click();

    // Assert payload details
    expect(savePayload).not.toBeNull();
    expect(savePayload.title).toBe('Super Gold');
    expect(savePayload.slug).toBe('super-gold');
    expect(savePayload.pricing.oneTime.amount).toBe(9999);
    expect(savePayload.validityDays).toBe(365);

    // 2. QUICK STATUS CHANGE
    await page.locator('button:has-text("Publish")').click();
    expect(statusPayload).not.toBeNull();
    expect(statusPayload.status).toBe('published');
  });
});
