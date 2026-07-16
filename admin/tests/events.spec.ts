import { test, expect } from '@playwright/test';
import { loginAsAdmin, mockApi, CORS_HEADERS } from './helpers/auth.mock';

test.describe('Events & Products Catalog (F07/F08)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock events list
    await mockApi(page, '**/api/events/all', {
      success: true,
      events: [
        {
          _id: 'event-123',
          title: 'Spiritual Satsang Weekend',
          slug: 'spiritual-satsang-weekend',
          locationType: 'online',
          isActive: true,
          dateTime: '2026-07-25T18:00:00.000Z',
          price: 150,
        },
      ],
    });

    // 2. Mock shops listing
    await mockApi(page, '**/api/shops', {
      success: true,
      shops: [{ _id: 'shop-123', name: 'Paramsukh Wellness Shop' }],
    });

    // 3. Mock categories listing
    await mockApi(page, '**/api/categories', {
      success: true,
      categories: [{ _id: 'cat-123', name: 'Spiritual Accessories' }],
    });

    // 4. Mock products list
    await mockApi(page, '**/api/products', {
      success: true,
      products: [
        {
          _id: 'product-123',
          name: 'Pure Rudraksha Mala',
          slug: 'pure-rudraksha-mala',
          pricing: { mrp: 500, sellingPrice: 399 },
          inventory: { stock: 50 },
          productType: 'regular',
          isActive: true,
        },
      ],
    });
  });

  test('should display events, load products, and support mock product additions', async ({ page }) => {
    let addProductPayload: any = null;
    await page.route('**/api/products/admin/create', async (route) => {
      addProductPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          product: { _id: 'product-new', ...addProductPayload },
        }),
      });
    });

    // Login and go to Events
    await loginAsAdmin(page);
    await page.goto('/dashboard/events');

    // Verify event is listed
    await expect(page.locator('text=Spiritual Satsang Weekend')).toBeVisible();

    // Go to Products
    await page.goto('/dashboard/products');

    // Verify existing product is listed
    await expect(page.locator('text=Pure Rudraksha Mala')).toBeVisible();

    // Click "Add Product" button
    await page.locator('button:has-text("Add Product")').click();

    // Fill product details
    await page.locator('input[placeholder="e.g. Premium Yoga Mat"]').fill('Premium Incense Sticks');
    await page.locator('textarea[placeholder="Product description..."]').fill('Organic premium grade meditative incense.');
    await page.locator('input[placeholder="0.00"]').fill('199');
    await page.locator('input[placeholder="0"]').fill('100');

    // Click Save
    await page.locator('button:has-text("Create Product")').click();

    // Verify creation payload
    expect(addProductPayload).not.toBeNull();
    expect(addProductPayload.name).toBe('Premium Incense Sticks');
    expect(addProductPayload.price).toBe(199);
    expect(addProductPayload.stock).toBe(100);
  });
});
