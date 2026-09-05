import { Page, expect } from '@playwright/test';
import { getUserByRole, UserRole, ROUTES } from '../fixtures/test-data';

/**
 * Login helper for DealFlow360
 * 
 * Based on actual implementation:
 * - Route: /login
 * - Email input: id="email"
 * - Password input: id="password"
 * - Submit button: type="submit"
 * - Success redirect: / (dashboard)
 * - Auth stored in: localStorage (dealflow360_access_token, dealflow360_user)
 */

/**
 * Login as a specific user role
 * 
 * @param page - Playwright page object
 * @param role - User role (salesRep, salesManager, finance, admin, customer)
 * 
 * @example
 * await loginAs(page, 'salesRep');
 */
export async function loginAs(page: Page, role: UserRole): Promise<void> {
  const user = getUserByRole(role);

  // Navigate to login page
  await page.goto(ROUTES.login);

  // Wait for login page to load
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

  // Fill in email (using id selector from actual implementation)
  await page.locator('#email').fill(user.email);

  // Fill in password
  await page.locator('#password').fill(user.password);

  // Click sign in button
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for successful authentication
  // The app redirects to dashboard (/) after successful login
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 10000,
  });

  // Verify authentication succeeded by checking for authenticated UI element
  // The AppShell shows user info in the top bar after successful login
  await expect(page.getByText(user.expectedName)).toBeVisible({ timeout: 5000 });

  // Additional verification: check that auth token exists in localStorage
  const hasToken = await page.evaluate(() => {
    return !!window.localStorage.getItem('dealflow360_access_token');
  });

  if (!hasToken) {
    throw new Error(`Login failed for ${role}: No auth token found in localStorage`);
  }
}

/**
 * Logout current user
 * 
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  try {
    // Look for logout button (LogOut icon button in AppShell)
    const logoutButton = page.getByRole('button', { name: /sign out/i });
    
    if (await logoutButton.isVisible({ timeout: 2000 })) {
      await logoutButton.click();
      
      // Wait for redirect to login page
      await page.waitForURL(ROUTES.login, { timeout: 5000 });
      
      // Verify localStorage is cleared
      const hasToken = await page.evaluate(() => {
        return !!window.localStorage.getItem('dealflow360_access_token');
      });
      
      if (hasToken) {
        console.warn('Logout: Auth token still present in localStorage');
      }
    }
  } catch (error) {
    // If logout fails, try to clear session manually
    await page.evaluate(() => {
      window.localStorage.removeItem('dealflow360_access_token');
      window.localStorage.removeItem('dealflow360_user');
    });
    
    // Navigate to login page
    await page.goto(ROUTES.login);
  }
}

/**
 * Check if user is currently authenticated
 * 
 * @param page - Playwright page object
 * @returns true if authenticated, false otherwise
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const hasToken = await page.evaluate(() => {
    return !!window.localStorage.getItem('dealflow360_access_token');
  });

  return hasToken;
}

/**
 * Clear authentication state
 * 
 * @param page - Playwright page object
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.localStorage.removeItem('dealflow360_access_token');
    window.localStorage.removeItem('dealflow360_user');
  });
}
