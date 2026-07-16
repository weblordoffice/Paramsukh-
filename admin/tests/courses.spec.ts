import { test, expect } from '@playwright/test';
import { loginAsAdmin, mockApi, CORS_HEADERS } from './helpers/auth.mock';

test.describe('Courses Content Management (F05)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock plans
    await mockApi(page, '**/api/membership-plans', {
      success: true,
      data: [{ _id: 'plan-pro', slug: 'pro', title: 'Pro Plan', status: 'published' }],
    });

    // 2. Mock courses listing
    await mockApi(page, '**/api/courses/all', {
      success: true,
      courses: [
        {
          _id: 'course-123',
          title: 'Yoga Basics',
          slug: 'yoga-basics',
          shortDescription: 'Introduction to Yoga',
          isActive: true,
          category: 'spiritual',
          includedInPlans: ['pro'],
        },
      ],
    });

    // 3. Mock course details APIs (populated with sub-resource arrays)
    await mockApi(page, '**/api/courses/course-123', {
      success: true,
      course: {
        _id: 'course-123',
        title: 'Yoga Basics',
        slug: 'yoga-basics',
        shortDescription: 'Introduction to Yoga',
        description: 'Full course description',
        isActive: true,
        category: 'spiritual',
        includedInPlans: ['pro'],
        videos: [
          {
            _id: 'video-11',
            title: 'First Asana Lesson',
            videoURL: 'https://www.youtube.com/watch?v=1',
            order: 1,
            isFreeTrial: true,
          },
        ],
        pdfs: [],
        liveSessions: [],
        assignments: [],
      },
    });

    // 4. Mock Course Videos
    await mockApi(page, '**/api/courses/course-123/videos', {
      success: true,
      videos: [
        {
          _id: 'video-11',
          title: 'First Asana Lesson',
          videoURL: 'https://www.youtube.com/watch?v=1',
          order: 1,
          isFreeTrial: true,
        },
      ],
    });

    // 5. Mock Course PDFs
    await mockApi(page, '**/api/courses/course-123/pdfs', {
      success: true,
      pdfs: [],
    });

    // 6. Mock Course Sessions
    await mockApi(page, '**/api/courses/course-123/live-sessions', {
      success: true,
      sessions: [],
    });
  });

  test('should view courses and manage a course videos list', async ({ page }) => {
    // Intercept video creation
    let addVideoPayload: any = null;
    await page.route('**/api/courses/course-123/videos', async (route) => {
      if (route.request().method() === 'POST') {
        addVideoPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          headers: CORS_HEADERS,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            video: {
              _id: 'video-22',
              ...addVideoPayload,
            },
          }),
        });
      } else {
        await route.fallback();
      }
    });

    // Login and go to Courses
    await loginAsAdmin(page);
    await page.goto('/dashboard/courses');

    // Confirm course is listed
    await expect(page.locator('text=Yoga Basics')).toBeVisible();

    // Navigate to course detail directly
    await page.goto('/dashboard/courses/course-123');

    // Verify course detail page loaded
    await expect(page.locator('h1:has-text("Yoga Basics")')).toBeVisible();

    // Verify existing video loads
    await expect(page.locator('text=First Asana Lesson')).toBeVisible();

    // Click Add Video button
    await page.locator('button:has-text("Add Video")').click();

    // Fill video details
    await page.locator('input[placeholder="Introduction to the Course"]').fill('Pranayama Deep Dive');
    await page.locator('input[placeholder="https://vimeo.com/..."]').fill('https://www.youtube.com/watch?v=2');
    await page.locator('input[placeholder="30"]').fill('15'); // duration

    // Click Save
    await page.locator('form button[type="submit"]').click();

    // Assert video creation payload
    expect(addVideoPayload).not.toBeNull();
    expect(addVideoPayload.title).toBe('Pranayama Deep Dive');
    expect(addVideoPayload.videoUrl).toBe('https://www.youtube.com/watch?v=2');
  });
});
