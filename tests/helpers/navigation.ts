import { Page, expect } from '@playwright/test';
import { ROUTES } from '../fixtures/test-data';

/**
 * Navigation helpers for DealFlow360 E2E tests
 */

/**
 * Wait for page to be fully loaded and stable
 */
export async function waitForPageLoad(page: Page, timeout = 3000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Navigate to a route and wait for it to load
 */
export async function navigateAndWait(page: Page, route: string) {
  await page.goto(route);
  await waitForPageLoad(page);
}

/**
 * Wait for API call to complete
 */
export async function waitForApiCall(page: Page, urlPattern: string | RegExp, timeout = 5000) {
  return page.waitForResponse(
    response => {
      const url = response.url();
      const matches = typeof urlPattern === 'string' 
        ? url.includes(urlPattern)
        : urlPattern.test(url);
      return matches && response.status() < 400;
    },
    { timeout }
  );
}

/**
 * Open a specific quotation by ID
 */
export async function openQuotation(page: Page, quotationId: string) {
  await page.goto(`${ROUTES.quotations}?quote=${quotationId}`);
  await page.waitForTimeout(1000);
  
  // Verify quotation loaded
  await expect(page.locator('.quotation-builder-layout')).toBeVisible({ timeout: 5000 });
}

/**
 * Get quotation ID from current URL
 */
export function getQuotationIdFromUrl(url: string): string | null {
  const match = url.match(/[?&]quote=([^&]+)/);
  return match ? match[1] : null;
}

/**
 * Wait for element with retry
 */
export async function waitForElement(
  page: Page, 
  selector: string, 
  options: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' } = {}
) {
  const timeout = options.timeout || 5000;
  const state = options.state || 'visible';
  
  return page.waitForSelector(selector, { timeout, state });
}
