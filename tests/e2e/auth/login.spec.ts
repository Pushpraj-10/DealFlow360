import { test, expect } from '@playwright/test';
import { loginAs, clearAuth } from '../../helpers/login';
import { assertOnLoginPage, assertAuthenticated, assertUserInfoVisible, assertErrorVisible } from '../../helpers/assertions';
import { TEST_USERS, ROUTES } from '../../fixtures/test-data';

/**
 * Authentication Tests - Login
 * 
 * Tests the login functionality with real test accounts
 * 
 * Prerequisites:
 * - Backend running on http://localhost:8001
 * - Frontend running on http://localhost:3000 (or configured baseURL)
 * - Database seeded with test accounts
 */

test.describe('Authentication - Login', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state before each test
    await page.goto('/');
    await clearAuth(page);
  });

  test('Sales Rep can login successfully', async ({ page }) => {
    // This is the SMOKE TEST
    const user = TEST_USERS.salesRep;

    // Navigate to login page
    await page.goto(ROUTES.login);

    // Verify we're on the login page
    await assertOnLoginPage(page);

    // Fill in credentials using actual DOM selectors
    // Note: Login page has default values pre-filled from useState
    // Playwright's fill() should handle this by clearing first
    await page.locator('#email').fill(''); // Clear first
    await page.locator('#email').fill(user.email);
    
    await page.locator('#password').fill(''); // Clear first
    await page.locator('#password').fill(user.password);

    // Submit the form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10000,
    });

    // Verify authentication succeeded
    await assertAuthenticated(page);

    // Verify user is redirected to dashboard
    await expect(page).toHaveURL(ROUTES.dashboard);

    // Verify dashboard heading is visible
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();

    // Verify user info displays in top bar
    await assertUserInfoVisible(page, user.expectedName);

    // Verify user role is displayed
    await expect(page.getByText(user.role)).toBeVisible();

    // Verify auth token exists in localStorage
    const authToken = await page.evaluate(() => {
      return window.localStorage.getItem('dealflow360_access_token');
    });
    expect(authToken).toBeTruthy();
    expect(authToken).not.toBe('');
  });

  // Additional test placeholders (to be implemented later)
  test.skip('Invalid credentials show error message', async ({ page }) => {
    await page.goto(ROUTES.login);

    await page.locator('#email').fill('invalid@test.com');
    await page.locator('#password').fill('wrongpassword');

    await page.getByRole('button', { name: /sign in/i }).click();

    // Should stay on login page
    await assertOnLoginPage(page);

    // Should show error message
    await assertErrorVisible(page);
  });

  test.skip('Empty credentials are rejected', async ({ page }) => {
    await page.goto(ROUTES.login);

    // Try to submit without filling anything
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should still be on login page (HTML5 validation prevents submission)
    await assertOnLoginPage(page);
  });

  test.skip('Logout redirects to login page', async ({ page }) => {
    // Login first
    await loginAs(page, 'salesRep');

    // Click logout button
    await page.getByRole('button', { name: /sign out/i }).click();

    // Should redirect to login page
    await assertOnLoginPage(page);

    // Auth token should be cleared
    const authToken = await page.evaluate(() => {
      return window.localStorage.getItem('dealflow360_access_token');
    });
    expect(authToken).toBeNull();
  });
});
