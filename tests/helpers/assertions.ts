import { Page, expect } from '@playwright/test';

/**
 * Custom assertion helpers for DealFlow360
 * 
 * These provide reusable assertions for common verification patterns
 */

/**
 * Assert user is on the login page
 */
export async function assertOnLoginPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
}

/**
 * Assert user is authenticated (not on login page)
 */
export async function assertAuthenticated(page: Page): Promise<void> {
  // Should not be on login page
  await expect(page).not.toHaveURL(/\/login/);
  
  // Should have auth token in localStorage
  const hasToken = await page.evaluate(() => {
    return !!window.localStorage.getItem('dealflow360_access_token');
  });
  
  expect(hasToken).toBe(true);
}

/**
 * Assert user info is visible in the top bar
 */
export async function assertUserInfoVisible(page: Page, expectedName: string): Promise<void> {
  await expect(page.getByText(expectedName)).toBeVisible();
}

/**
 * Assert error message is displayed
 */
export async function assertErrorVisible(page: Page): Promise<void> {
  // Check for error alert (from login page implementation)
  const errorAlert = page.locator('.df-alert-error');
  await expect(errorAlert).toBeVisible();
}
